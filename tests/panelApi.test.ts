import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requestJson,
  requestOrThrow,
  getJson,
  postJson,
  deleteJson,
  patchJson,
  putJson,
  errorMessageFrom,
  arrayFrom,
  queryString,
} from "@/lib/email/panelApi";

const mockFetch = vi.fn();
beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

/** Minimal Response stand-in: `json()` may reject to simulate an empty/non-JSON body. */
const res = (status: number, body: unknown, { badJson = false } = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: badJson ? () => Promise.reject(new Error("not json")) : () => Promise.resolve(body),
  }) as unknown as Response;

describe("requestJson", () => {
  it("returns ok with the parsed payload on success", async () => {
    mockFetch.mockResolvedValue(res(200, { hello: "world" }));
    const result = await requestJson<{ hello: string }>("/api/x");
    expect(result).toMatchObject({ ok: true, status: 200, data: { hello: "world" } });
  });

  it("surfaces the server's message on an error status", async () => {
    mockFetch.mockResolvedValue(res(400, { message: "Bad input." }));
    const result = await requestJson("/api/x", { fallbackMessage: "Fallback." });
    expect(result).toMatchObject({ ok: false, status: 400, message: "Bad input." });
  });

  it("falls back when the error body carries no message", async () => {
    mockFetch.mockResolvedValue(res(500, {}));
    const result = await requestJson("/api/x", { fallbackMessage: "Could not save." });
    expect(result).toMatchObject({ ok: false, message: "Could not save." });
  });

  it("tolerates an empty or non-JSON body", async () => {
    mockFetch.mockResolvedValue(res(204, null, { badJson: true }));
    const result = await requestJson("/api/x");
    expect(result.ok).toBe(true);
  });

  it("resolves (does not reject) when the network fails", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));
    const result = await requestJson("/api/x", { fallbackMessage: "Offline." });
    expect(result).toMatchObject({ ok: false, status: 0, message: "Offline." });
  });

  it("adds JSON headers and a serialized body only when json is given", async () => {
    mockFetch.mockResolvedValue(res(200, {}));
    await requestJson("/api/x", { method: "POST", json: { a: 1 } });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ a: 1 }));

    mockFetch.mockClear();
    mockFetch.mockResolvedValue(res(200, {}));
    await requestJson("/api/x");
    const [, getInit] = mockFetch.mock.calls[0];
    expect(getInit.body).toBeUndefined();
  });
});

describe("requestOrThrow", () => {
  it("returns data on success and throws the server message on failure", async () => {
    mockFetch.mockResolvedValue(res(200, { ok: 1 }));
    await expect(requestOrThrow("/api/x")).resolves.toEqual({ ok: 1 });

    mockFetch.mockResolvedValue(res(422, { message: "Nope." }));
    await expect(requestOrThrow("/api/x")).rejects.toThrow("Nope.");
  });
});

describe("verb shorthands", () => {
  it("use the right method", async () => {
    mockFetch.mockResolvedValue(res(200, {}));
    await getJson("/a");
    expect(mockFetch.mock.calls[0][1].method).toBeUndefined();

    await postJson("/a", { x: 1 });
    expect(mockFetch.mock.calls[1][1].method).toBe("POST");

    await deleteJson("/a");
    expect(mockFetch.mock.calls[2][1].method).toBe("DELETE");
    expect(mockFetch.mock.calls[2][1].body).toBeUndefined();

    await patchJson("/a", { p: 1 });
    expect(mockFetch.mock.calls[3][1].method).toBe("PATCH");
    expect(mockFetch.mock.calls[3][1].body).toBe(JSON.stringify({ p: 1 }));

    await putJson("/a");
    expect(mockFetch.mock.calls[4][1].method).toBe("PUT");
    expect(mockFetch.mock.calls[4][1].body).toBe("{}");
  });
});

describe("payload helpers", () => {
  it("errorMessageFrom prefers a non-empty string message", () => {
    expect(errorMessageFrom({ message: "boom" }, "fb")).toBe("boom");
    expect(errorMessageFrom({ message: "  " }, "fb")).toBe("fb");
    expect(errorMessageFrom(null, "fb")).toBe("fb");
    expect(errorMessageFrom({ message: 42 }, "fb")).toBe("fb");
  });

  it("arrayFrom returns the array or an empty one", () => {
    expect(arrayFrom({ tags: [1, 2] }, "tags")).toEqual([1, 2]);
    expect(arrayFrom({ tags: "nope" }, "tags")).toEqual([]);
    expect(arrayFrom(null, "tags")).toEqual([]);
  });

  it("queryString skips empty values and prefixes ?", () => {
    expect(queryString({ a: 1, b: "", c: undefined, d: null, e: "x" })).toBe("?a=1&e=x");
    expect(queryString({})).toBe("");
    expect(queryString({ a: false })).toBe("?a=false");
  });
});
