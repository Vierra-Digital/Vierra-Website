// Reuse an attempt across network failures and the undo-send/unload paths. No
// message content is persisted outside the existing draft storage system.
const attempts = new Map<string, { requestId: string; body: string }>();
export function prepareSendRequest(payload: Record<string, unknown>) {
  const key = String(payload.draftKey || `${payload.accountEmail}:${payload.threadId || "compose"}`);
  const body = JSON.stringify(payload);
  const existing = attempts.get(key);
  if (existing && existing.body !== body) throw new Error("An earlier send for this draft is unconfirmed. Check Sent or Scheduled before changing and resending it.");
  const attempt = existing || { requestId: crypto.randomUUID(), body };
  attempts.set(key, attempt);
  return { ...payload, requestId: attempt.requestId };
}
export async function sendPanelEmail(payload: Record<string, unknown>) {
  const prepared = "requestId" in payload ? payload : prepareSendRequest(payload);
  const response = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prepared) });
  const result = await response.clone().json().catch(() => null);
  if (result?.notSent === true || (response.ok && result?.ok === true) || (response.status >= 400 && response.status < 500 && response.status !== 409)) {
    const key = String(payload.draftKey || `${payload.accountEmail}:${payload.threadId || "compose"}`);
    attempts.delete(key);
  }
  return response;
}
