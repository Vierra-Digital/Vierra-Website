import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { runSendAttempt } from "@/lib/gmail/sendAttempt";

const requestId = "11111111-1111-4111-8111-111111111111";
const payload = { requestId, to: "recipient@example.com", body: "Hello" };
const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
beforeEach(() => { vi.resetAllMocks(); db.$executeRaw.mockResolvedValue(1); });

describe("durable send attempts", () => {
  it("stores the confirmed result after dispatch", async () => {
    db.$queryRaw.mockResolvedValue([{ request_id: requestId }]);
    const send = vi.fn().mockResolvedValue({ status: 200, body: { ok: true } });
    expect(await runSendAttempt("user", requestId, payload, send)).toEqual({ status: 200, body: { ok: true } });
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it("replays a confirmed receipt without sending again", async () => {
    db.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ payload_hash: hash, state: "completed", status_code: 200, result: { ok: true } }]);
    const send = vi.fn();
    expect((await runSendAttempt("user", requestId, payload, send)).body.ok).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });
  it.each(["pending", "uncertain"])("does not resend a %s attempt", async state => {
    db.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ payload_hash: hash, state }]);
    const send = vi.fn();
    expect((await runSendAttempt("user", requestId, payload, send)).status).toBe(409);
    expect(send).not.toHaveBeenCalled();
  });
  it("rejects changed content under an existing attempt", async () => {
    db.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ payload_hash: "different", state: "completed" }]);
    const send = vi.fn();
    expect((await runSendAttempt("user", requestId, payload, send)).status).toBe(409);
    expect(send).not.toHaveBeenCalled();
  });
  it("never dispatches when receipt storage is unavailable", async () => {
    db.$queryRaw.mockRejectedValue(new Error("Database unavailable"));
    const send = vi.fn();
    expect((await runSendAttempt("user", requestId, payload, send)).body.notSent).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });
  it("marks a lost provider response uncertain", async () => {
    db.$queryRaw.mockResolvedValue([{ request_id: requestId }]);
    const send = vi.fn().mockRejectedValue(new Error("Response lost"));
    expect((await runSendAttempt("user", requestId, payload, send)).status).toBe(503);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
