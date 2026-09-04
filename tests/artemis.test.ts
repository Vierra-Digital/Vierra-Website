import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * lib/ai/artemis reads its configuration into module-level consts, so every case here has to set
 * the environment *before* importing it — hence resetModules + a dynamic import in the helper
 * rather than a top-level import.
 *
 * What these cover is a bug that shipped silently: an empty completion came back as
 * `{ ok: true, text: "" }`, and since every caller only branches on `ok`, /api/ai/compose, reply
 * and rewrite answered 200 with an empty string while the campaign reply classifier fell back to
 * its default status on every message. Nothing logged, nothing surfaced.
 */

type Body = Record<string, unknown>;

function mockFetch(response: unknown, ok = true, status = 200) {
  const spy = vi.fn(async () => ({
    ok,
    status,
    json: async () => response,
  }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** Import a fresh copy of the module with `env` applied. */
async function loadArtemis(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("@/lib/ai/artemis");
}

const OPENAI_ENV = {
  ARTEMIS_PROVIDER: "openai",
  ARTEMIS_BASE_URL: "http://lan.test/v1",
  ARTEMIS_API_KEY: "k",
  ARTEMIS_MODEL: "test-model",
};

const CALL = { system: "s", messages: [{ role: "user" as const, content: "u" }] };

/** The shape vLLM returns for a reasoning model that never reached its answer. */
const REASONED_AWAY = {
  choices: [
    {
      finish_reason: "length",
      message: { role: "assistant", content: null, reasoning: "Let me think about this..." },
    },
  ],
};

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("artemisGenerate — empty completions", () => {
  it("reports a reasoning model that never produced content as a failure, not an empty success", async () => {
    mockFetch(REASONED_AWAY);
    const { artemisGenerate } = await loadArtemis(OPENAI_ENV);
    const result = await artemisGenerate(CALL);

    expect(result.ok).toBe(false);
    // The message has to name the fix, because the symptom (a blank panel) points nowhere.
    if (!result.ok) expect(result.error).toContain("ARTEMIS_DISABLE_THINKING");
  });

  it("distinguishes a plain token-limit truncation from a reasoning pass", async () => {
    mockFetch({ choices: [{ finish_reason: "length", message: { content: "" } }] });
    const { artemisGenerate } = await loadArtemis(OPENAI_ENV);
    const result = await artemisGenerate(CALL);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("maxTokens");
      expect(result.error).not.toContain("ARTEMIS_DISABLE_THINKING");
    }
  });

  it("treats an empty anthropic completion the same way", async () => {
    mockFetch({ content: [{ text: "" }] });
    const { artemisGenerate } = await loadArtemis({
      ARTEMIS_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "k",
    });
    const result = await artemisGenerate(CALL);

    expect(result.ok).toBe(false);
  });

  it("still returns real content as a success", async () => {
    mockFetch({ choices: [{ finish_reason: "stop", message: { content: "  hello  " } }] });
    const { artemisGenerate } = await loadArtemis(OPENAI_ENV);
    const result = await artemisGenerate(CALL);

    expect(result).toEqual({ ok: true, text: "hello" });
  });
});

describe("artemisGenerate — ARTEMIS_DISABLE_THINKING", () => {
  it("omits the vLLM field by default, since hosted OpenAI rejects unknown body fields", async () => {
    const spy = mockFetch({ choices: [{ message: { content: "x" } }] });
    const { artemisGenerate } = await loadArtemis(OPENAI_ENV);
    await artemisGenerate(CALL);

    const body = JSON.parse((spy.mock.calls[0] as unknown as [string, { body: string }])[1].body) as Body;
    expect(body).not.toHaveProperty("chat_template_kwargs");
  });

  it("sends enable_thinking:false when the flag is set", async () => {
    const spy = mockFetch({ choices: [{ message: { content: "x" } }] });
    const { artemisGenerate } = await loadArtemis({ ...OPENAI_ENV, ARTEMIS_DISABLE_THINKING: "1" });
    await artemisGenerate(CALL);

    const body = JSON.parse((spy.mock.calls[0] as unknown as [string, { body: string }])[1].body) as Body;
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("accepts 'true' as well as '1', and ignores anything else", async () => {
    for (const [value, expected] of [
      ["true", true],
      ["yes", true],
      ["0", false],
      ["", false],
    ] as const) {
      const spy = mockFetch({ choices: [{ message: { content: "x" } }] });
      const { artemisGenerate } = await loadArtemis({ ...OPENAI_ENV, ARTEMIS_DISABLE_THINKING: value });
      await artemisGenerate(CALL);
      const body = JSON.parse((spy.mock.calls[0] as unknown as [string, { body: string }])[1].body) as Body;
      expect(Object.hasOwn(body, "chat_template_kwargs"), `value ${JSON.stringify(value)}`).toBe(expected);
      vi.unstubAllGlobals();
    }
  });
});

describe("artemisConfigured", () => {
  it("needs a key for the anthropic provider", async () => {
    const a = await loadArtemis({ ARTEMIS_PROVIDER: "anthropic", ARTEMIS_API_KEY: "", ANTHROPIC_API_KEY: "" });
    expect(a.artemisConfigured()).toBe(false);

    const b = await loadArtemis({ ARTEMIS_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" });
    expect(b.artemisConfigured()).toBe(true);
  });

  it("needs only a base URL for a self-hosted openai-compatible endpoint", async () => {
    // A LAN box often has no key at all, which is why this branch does not check for one.
    const { artemisConfigured } = await loadArtemis({
      ARTEMIS_PROVIDER: "openai",
      ARTEMIS_BASE_URL: "http://lan.test/v1",
      ARTEMIS_API_KEY: "",
    });
    expect(artemisConfigured()).toBe(true);
  });

  it("refuses to call out when nothing is configured", async () => {
    const spy = mockFetch({});
    const { artemisGenerate } = await loadArtemis({
      ARTEMIS_PROVIDER: "anthropic",
      ARTEMIS_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    });
    const result = await artemisGenerate(CALL);

    expect(result.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("artemisGenerate — transport failures", () => {
  it("surfaces the provider's own error message on a non-2xx", async () => {
    mockFetch({ error: { message: "model not found" } }, false, 404);
    const { artemisGenerate } = await loadArtemis(OPENAI_ENV);
    const result = await artemisGenerate(CALL);

    expect(result).toEqual({ ok: false, error: "model not found" });
  });

  it("falls back to the status code when the body carries no message", async () => {
    mockFetch({}, false, 502);
    const { artemisGenerate } = await loadArtemis(OPENAI_ENV);
    const result = await artemisGenerate(CALL);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("502");
  });

  it("returns an error rather than throwing when the endpoint is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const { artemisGenerate } = await loadArtemis(OPENAI_ENV);
    const result = await artemisGenerate(CALL);

    expect(result).toEqual({ ok: false, error: "ECONNREFUSED" });
  });

  it("sends the anthropic-shaped request for the anthropic provider", async () => {
    const spy = mockFetch({ content: [{ text: "hi" }] });
    const { artemisGenerate } = await loadArtemis({ ARTEMIS_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" });
    const result = await artemisGenerate(CALL);

    expect(result).toEqual({ ok: true, text: "hi" });
    const [url, init] = spy.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toContain("/v1/messages");
    expect(init.headers["x-api-key"]).toBe("k");
  });
});

describe("artemisGenerate — malformed responses", () => {
  it("surfaces an anthropic error body on a non-2xx", async () => {
    mockFetch({ error: { message: "overloaded" } }, false, 529);
    const { artemisGenerate } = await loadArtemis({ ARTEMIS_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" });
    const result = await artemisGenerate(CALL);

    expect(result).toEqual({ ok: false, error: "overloaded" });
  });

  it("does not throw when the provider returns a body that is not JSON", async () => {
    // A proxy or WAF in front of a self-hosted endpoint answers 200 with an HTML error page more
    // often than you would like; res.json() rejects and the catch has to absorb it.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } }))
    );
    const { artemisGenerate } = await loadArtemis(OPENAI_ENV);
    const result = await artemisGenerate(CALL);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("The model returned an empty response.");
  });
});
