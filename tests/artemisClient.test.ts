import { afterEach, describe, expect, it, vi } from "vitest";

// lib/ai/artemis reads its config into module-level consts at import time, so every case
// stubs the env first and then imports a fresh copy of the module.
async function loadClient(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("@/lib/ai/artemis");
}

/** One OpenAI-compatible chat completion, as vLLM returns it. */
function completion(message: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ index: 0, message }] }),
  } as unknown as Response;
}

const BASE_ENV = {
  ARTEMIS_PROVIDER: "openai",
  ARTEMIS_BASE_URL: "http://spark.test/v1",
  ARTEMIS_API_KEY: "k",
  ARTEMIS_MODEL: "qwen3",
};

const ASK = { system: "s", messages: [{ role: "user" as const, content: "hi" }] };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("artemisGenerate — reasoning models", () => {
  it("asks the server to skip the chain of thought when ARTEMIS_DISABLE_THINKING is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion({ content: "a draft" }));
    vi.stubGlobal("fetch", fetchMock);

    const { artemisGenerate } = await loadClient({ ...BASE_ENV, ARTEMIS_DISABLE_THINKING: "1" });
    const result = await artemisGenerate(ASK);

    expect(result).toEqual({ ok: true, text: "a draft" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("omits the vLLM-only field by default, so real OpenAI does not reject the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion({ content: "a draft" }));
    vi.stubGlobal("fetch", fetchMock);

    const { artemisGenerate } = await loadClient(BASE_ENV);
    await artemisGenerate(ASK);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("chat_template_kwargs");
  });

  it("fails loudly when the model spent the whole budget thinking", async () => {
    // Qwen3 on vLLM: the token budget went to `reasoning` and `content` came back null.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion({ content: null, reasoning: "step 1..." })));

    const { artemisGenerate } = await loadClient(BASE_ENV);
    const result = await artemisGenerate(ASK);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/reasoning/i);
  });

  it("never passes the chain of thought off as the answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion({ content: null, reasoning: "secret plan" })));

    const { artemisGenerate } = await loadClient(BASE_ENV);
    const result = await artemisGenerate(ASK);

    expect(JSON.stringify(result)).not.toContain("secret plan");
  });

  it("reports an empty response rather than returning empty text as success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion({ content: "   " })));

    const { artemisGenerate } = await loadClient(BASE_ENV);
    const result = await artemisGenerate(ASK);

    expect(result).toEqual({ ok: false, error: "The model returned an empty response." });
  });

  it("prepends the house style guide, since the passthrough applies none of its own", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion({ content: "a draft" }));
    vi.stubGlobal("fetch", fetchMock);

    const { artemisGenerate } = await loadClient(BASE_ENV);
    await artemisGenerate({ ...ASK, system: "You are Artemis. Draft an email." });

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0];
    expect(sent.role).toBe("system");
    expect(sent.content).toContain("write like a real person");
    // The caller's own instructions must still be there, and last, so they read as the specific
    // task rather than being buried above three screens of style rules.
    expect(sent.content.endsWith("You are Artemis. Draft an email.")).toBe(true);
  });

  it("cleans the reply, so an em dash never reaches a draft", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion({ content: "We ship fast — and well." })));

    const { artemisGenerate } = await loadClient(BASE_ENV);
    const result = await artemisGenerate(ASK);

    expect(result).toEqual({ ok: true, text: "We ship fast, and well." });
  });

  it("leaves the prompt and the reply alone when humanize is off", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion({ content: "raw — text" }));
    vi.stubGlobal("fetch", fetchMock);

    const { artemisGenerate } = await loadClient(BASE_ENV);
    const result = await artemisGenerate({ ...ASK, humanize: false });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content).toBe("s");
    expect(result).toEqual({ ok: true, text: "raw — text" });
  });

  it("surfaces the server's own error message on a non-2xx reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: "The model `fast` does not exist." } }),
      } as unknown as Response)
    );

    const { artemisGenerate } = await loadClient(BASE_ENV);
    const result = await artemisGenerate(ASK);

    expect(result).toEqual({ ok: false, error: "The model `fast` does not exist." });
  });
});
