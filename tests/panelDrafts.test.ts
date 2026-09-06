import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmDiscardDrafts, draftState, registerDraft, subscribeToDiscardConfirm } from "@/lib/panel/drafts";
import { resolvePanelSection } from "@/lib/panel/navigation";

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });
describe("panel draft protection", () => {
  it("isolates dirty state by section and unregisters closed editors", () => {
    const cleanup = registerDraft(Symbol(), { scope: "7", label: "Blog", busy: false });
    cleanups.push(cleanup);
    expect(draftState("7").dirty).toBe(true);
    expect(draftState("6").dirty).toBe(false);
    cleanup();
    expect(draftState().dirty).toBe(false);
  });
  it("blocks navigation during a save without offering discard", async () => {
    const alert = vi.fn();
    vi.stubGlobal("window", { alert });
    cleanups.push(registerDraft(Symbol(), { scope: "7", label: "Blog", busy: true }));
    await expect(confirmDiscardDrafts()).resolves.toBe(false);
    expect(alert).toHaveBeenCalledTimes(1);
  });
  it("resolves the shared modal request instead of a native confirm", async () => {
    cleanups.push(registerDraft(Symbol(), { scope: "client", label: "Context", busy: false }));
    const requests: unknown[] = [];
    const unsubscribe = subscribeToDiscardConfirm((request) => requests.push(request));
    cleanups.push(unsubscribe);

    const pending = confirmDiscardDrafts("client");
    // The request is published synchronously so a mounted modal can render it immediately.
    expect(requests.at(-1)).toMatchObject({ message: expect.stringContaining("Context") });

    (requests.at(-1) as { resolve: (v: boolean) => void }).resolve(false);
    await expect(pending).resolves.toBe(false);
    expect(draftState("client").dirty).toBe(true);
  });
  it("actually clears the matching drafts on a confirmed discard", async () => {
    // Regression test: a caller that retries its action right after confirming (e.g.
    // usePageLeaveGuard re-issuing a navigation it had to cancel) needs draftState() to already
    // read clean, or it re-triggers this same confirm forever — the dirty component itself may
    // still be mounted for a few more ticks, so this can't rely on its own unmount to clear it.
    cleanups.push(registerDraft(Symbol(), { scope: "email-settings", label: "Domain mailbox setup", busy: false }));
    cleanups.push(registerDraft(Symbol(), { scope: "other", label: "Unrelated", busy: false }));

    const requests: unknown[] = [];
    cleanups.push(subscribeToDiscardConfirm((request) => requests.push(request)));

    const pending = confirmDiscardDrafts("email-settings");
    (requests.at(-1) as { resolve: (v: boolean) => void }).resolve(true);
    await expect(pending).resolves.toBe(true);

    expect(draftState("email-settings").dirty).toBe(false);
    // A discard scoped to one editor must not clear an unrelated one.
    expect(draftState("other").dirty).toBe(true);
  });
});
describe("panel destinations", () => {
  it("rejects inaccessible and malformed section links", () => {
    expect(resolvePanelSection("users", "staff")).toEqual({ section: 0, invalid: true });
    expect(resolvePanelSection(["blog", "users"], "admin")).toEqual({ section: 0, invalid: true });
    expect(resolvePanelSection("blog", "staff")).toEqual({ section: 7, invalid: false });
  });
});
