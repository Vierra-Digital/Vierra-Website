import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmDiscardDrafts, draftState, registerDraft } from "@/lib/panel/drafts";
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
  it("blocks navigation during a save without offering discard", () => {
    const confirm = vi.fn();
    vi.stubGlobal("window", { alert: vi.fn(), confirm });
    cleanups.push(registerDraft(Symbol(), { scope: "7", label: "Blog", busy: true }));
    expect(confirmDiscardDrafts()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("honors a declined discard and keeps draft registration", () => {
    vi.stubGlobal("window", { confirm: vi.fn().mockReturnValue(false) });
    cleanups.push(registerDraft(Symbol(), { scope: "client", label: "Context", busy: false }));
    expect(confirmDiscardDrafts("client")).toBe(false);
    expect(draftState("client").dirty).toBe(true);
  });
});
describe("panel destinations", () => {
  it("rejects inaccessible and malformed section links", () => {
    expect(resolvePanelSection("users", "staff")).toEqual({ section: 0, invalid: true });
    expect(resolvePanelSection(["blog", "users"], "admin")).toEqual({ section: 0, invalid: true });
    expect(resolvePanelSection("blog", "staff")).toEqual({ section: 7, invalid: false });
  });
});
