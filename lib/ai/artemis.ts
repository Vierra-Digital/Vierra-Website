/**
 * Artemis AI — pluggable provider client.
 *
 * Works with the Claude API OR a self-hosted, OpenAI-compatible model on your LAN
 * (Ollama / vLLM / LM Studio / TGI) with no code change — only env config:
 *
 *   ARTEMIS_PROVIDER = "anthropic" | "openai"   (default: "anthropic")
 *   ARTEMIS_BASE_URL                            (default per provider; set to your LAN box,
 *                                               e.g. http://192.168.1.50:11434/v1)
 *   ARTEMIS_API_KEY   (falls back to ANTHROPIC_API_KEY for the anthropic provider)
 *   ARTEMIS_MODEL                               (default per provider)
 *
 * Server-side only — never import into client bundles.
 */

export type ArtemisMessage = { role: "user" | "assistant"; content: string };
export type ArtemisResult = { ok: true; text: string } | { ok: false; error: string };

const PROVIDER = (process.env.ARTEMIS_PROVIDER || "anthropic").toLowerCase();
const API_KEY = process.env.ARTEMIS_API_KEY || process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ARTEMIS_MODEL || (PROVIDER === "openai" ? "gpt-4o-mini" : "claude-sonnet-5");
const BASE_URL =
  (process.env.ARTEMIS_BASE_URL || "").replace(/\/$/, "") ||
  (PROVIDER === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com");

/** Whether Artemis has enough config to run (a self-hosted OpenAI endpoint may need no key). */
export function artemisConfigured(): boolean {
  if (PROVIDER === "anthropic") return Boolean(API_KEY);
  return Boolean(BASE_URL);
}

export async function artemisGenerate(opts: {
  system: string;
  messages: ArtemisMessage[];
  maxTokens?: number;
}): Promise<ArtemisResult> {
  const { system, messages, maxTokens = 1024 } = opts;
  if (!artemisConfigured()) {
    return { ok: false, error: "Artemis AI isn't configured yet. Set ARTEMIS_* environment variables." };
  }
  try {
    if (PROVIDER === "anthropic") {
      const res = await fetch(`${BASE_URL}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const err = (data as { error?: { message?: string } })?.error?.message;
        return { ok: false, error: err || `AI request failed (${res.status})` };
      }
      const content = (data as { content?: Array<{ text?: string }> })?.content;
      const text = Array.isArray(content) ? content.map((c) => c?.text || "").join("").trim() : "";
      return { ok: true, text };
    }

    // OpenAI-compatible (self-hosted LAN, OpenAI, etc.)
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(API_KEY ? { authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) {
      const err = (data as { error?: { message?: string } })?.error?.message;
      return { ok: false, error: err || `AI request failed (${res.status})` };
    }
    const text =
      (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content || "";
    return { ok: true, text: text.trim() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "AI request error" };
  }
}
