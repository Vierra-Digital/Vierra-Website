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
 *   ARTEMIS_DISABLE_THINKING = "1"|"true"      (openai provider only) turn off a reasoning
 *                                               model's thinking pass — see below
 *
 * Server-side only — never import into client bundles.
 */

import { cleanAiTells, withHumanizedSystem } from "@/lib/ai/humanize";

export type ArtemisMessage = { role: "user" | "assistant"; content: string };
export type ArtemisResult = { ok: true; text: string } | { ok: false; error: string };

const PROVIDER = (process.env.ARTEMIS_PROVIDER || "anthropic").toLowerCase();
const API_KEY = process.env.ARTEMIS_API_KEY || process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ARTEMIS_MODEL || (PROVIDER === "openai" ? "gpt-4o-mini" : "claude-sonnet-5");
/**
 * Reasoning models (Qwen3.x, DeepSeek-R1 and friends served by vLLM) spend the completion budget on
 * a thinking pass *before* they emit any `content`, and the thinking is not bounded by the prompt.
 * Measured against nvidia/Qwen3.6-35B-A3B-NVFP4: compose, reply and rewrite each burned all 900
 * tokens reasoning and returned `content: null`, and the campaign reply classifier — which asks for
 * a single word and budgets 8 tokens — could never return anything at all. Raising the budget does
 * not fix it: the same classify prompt still returned nothing at 512.
 *
 * vLLM accepts `chat_template_kwargs.enable_thinking: false` to skip that pass. With it, all six
 * call sites answer correctly with 0 reasoning tokens. It is opt-in because it is a vLLM/Qwen
 * extension: real OpenAI rejects an unknown body field, and a non-reasoning model does not need it.
 */
const DISABLE_THINKING = /^(1|true|yes)$/i.test(process.env.ARTEMIS_DISABLE_THINKING || "");

const BASE_URL =
  (process.env.ARTEMIS_BASE_URL || "").replace(/\/$/, "") ||
  (PROVIDER === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com");

/** Whether Artemis has enough config to run (a self-hosted OpenAI endpoint may need no key). */
export function artemisConfigured(): boolean {
  if (PROVIDER === "anthropic") return Boolean(API_KEY);
  return Boolean(BASE_URL);
}

/**
 * An empty completion used to come back as `{ ok: true, text: "" }`. Callers only branch on `ok`,
 * so /api/ai/compose, reply and rewrite answered 200 with an empty string and the panel rendered a
 * blank with nothing to explain it, while the campaign reply classifier fell back to the generic
 * "reply" status on every message without ever reporting a problem. A failure has to look like one.
 */
function emptyContentError(finishReason?: string, reasoning?: string | null): string {
  // Check `reasoning` before `finish_reason`. A model can stop for its own reasons mid-thought and
  // still hand back a null `content` with the whole budget sitting in `reasoning`, so gating this
  // message on finish_reason === "length" reported a bare "empty response" for the one case where
  // the cause is knowable and the fix is a named env var.
  if (reasoning) {
    return "The model spent its whole token budget on a reasoning pass and returned no answer. Set ARTEMIS_DISABLE_THINKING=1, or raise maxTokens.";
  }
  if (finishReason === "length") {
    return "The model hit the token limit before returning any text. Raise maxTokens.";
  }
  return "The model returned an empty response.";
}

export async function artemisGenerate(opts: {
  system: string;
  messages: ArtemisMessage[];
  maxTokens?: number;
  /**
   * Prepend the house style guide and clean the reply. On by default: the passthrough this client
   * talks to applies neither, so without it every panel feature writes like stock AI. Pass false
   * only when the output is parsed by code rather than read by a person.
   */
  humanize?: boolean;
}): Promise<ArtemisResult> {
  const { messages, maxTokens = 1024, humanize = true } = opts;
  const system = humanize ? withHumanizedSystem(opts.system) : opts.system;
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
        const raw = Array.isArray(content) ? content.map((c) => c?.text || "").join("").trim() : "";
        const text = humanize ? cleanAiTells(raw) : raw;
        if (!text) return { ok: false, error: emptyContentError((data as { stop_reason?: string })?.stop_reason) };
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
        ...(DISABLE_THINKING ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      }),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) {
      const err = (data as { error?: { message?: string } })?.error?.message;
      return { ok: false, error: err || `AI request failed (${res.status})` };
    }
      const choice = (data as {
        choices?: Array<{ message?: { content?: string | null; reasoning?: string | null }; finish_reason?: string }>;
      })?.choices?.[0];
      const raw = (choice?.message?.content || "").trim();
      const text = humanize ? cleanAiTells(raw) : raw;
      if (!text) return { ok: false, error: emptyContentError(choice?.finish_reason, choice?.message?.reasoning) };
    return { ok: true, text };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "AI request error" };
  }
}
