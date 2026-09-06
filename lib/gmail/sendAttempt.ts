import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type SendReceiptResult = { status: number; body: Record<string, unknown> };
type Receipt = { payload_hash: string; state: string; status_code: number | null; result: Record<string, unknown> | null };

export async function runSendAttempt(userId: string, requestId: unknown, payload: unknown, send: () => Promise<SendReceiptResult>): Promise<SendReceiptResult> {
  // Backward compatibility for existing integrations. The panel always supplies a key.
  if (requestId === undefined) return send();
  if (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return { status: 400, body: { message: "Invalid send request identifier." } };
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  try {
    const inserted = await prisma.$queryRaw<{ request_id: string }[]>`
      INSERT INTO public.email_send_attempts (user_id, request_id, payload_hash)
      VALUES (${userId}::uuid, ${requestId}::uuid, ${hash})
      ON CONFLICT DO NOTHING RETURNING request_id`;
    if (!inserted.length) {
      const [receipt] = await prisma.$queryRaw<Receipt[]>`SELECT payload_hash, state, status_code, result FROM public.email_send_attempts WHERE user_id = ${userId}::uuid AND request_id = ${requestId}::uuid`;
      if (receipt?.payload_hash !== hash) return { status: 409, body: { message: "This send attempt belongs to a different draft revision. Check Sent or Scheduled before starting another send." } };
      if (receipt.state === "completed" && receipt.result && receipt.status_code) return { status: receipt.status_code, body: receipt.result };
      return { status: 409, body: { message: "The original send is still processing or its result is unconfirmed. Check Sent or Scheduled. Retrying this attempt will not send a second copy." } };
    }
  } catch {
    return { status: 503, body: { notSent: true, message: "Send protection is unavailable. Nothing was sent; try again after the service is restored." } };
  }
  try {
    const result = await send();
    await prisma.$executeRaw`UPDATE public.email_send_attempts SET state = 'completed', status_code = ${result.status}, result = ${JSON.stringify(result.body)}::jsonb, updated_at = now() WHERE user_id = ${userId}::uuid AND request_id = ${requestId}::uuid`;
    return result;
  } catch {
    await prisma.$executeRaw`UPDATE public.email_send_attempts SET state = 'uncertain', updated_at = now() WHERE user_id = ${userId}::uuid AND request_id = ${requestId}::uuid`.catch(() => {});
    return { status: 503, body: { message: "Could not confirm sending. Check Sent or Scheduled before starting another attempt. Your draft is kept." } };
  }
}
