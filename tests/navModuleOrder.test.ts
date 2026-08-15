import { describe, it, expect } from "vitest";
import { MODULES, orderModules } from "@/components/email/constants";

/**
 * Sidebar ordering for the email panel. The panel and the settings page both render
 * through `orderModules`, so these cases pin the behaviour they share.
 */
describe("orderModules", () => {
  const keys = (items: Array<{ key: string }>) => items.map((m) => m.key);

  it("falls back to the built-in order when nothing is saved", () => {
    expect(keys(orderModules(MODULES, []))).toEqual(keys(MODULES));
  });

  it("applies a fully specified custom order", () => {
    const custom = ["trash", "inbox", "sent"];
    const items = MODULES.filter((m) => custom.includes(m.key));
    expect(keys(orderModules(items, custom))).toEqual(["trash", "inbox", "sent"]);
  });

  it("keeps unranked modules at the end in their original order", () => {
    // Only 'sent' is ranked; everything else should trail it, still in MODULES order.
    const ordered = orderModules(MODULES, ["sent"]);
    expect(ordered[0].key).toBe("sent");
    const rest = keys(ordered).slice(1);
    const expectedRest = keys(MODULES).filter((k) => k !== "sent");
    expect(rest).toEqual(expectedRest);
  });

  it("ignores saved keys that no longer exist", () => {
    const ordered = orderModules(MODULES, ["ghost-module", "starred"]);
    expect(ordered[0].key).toBe("starred");
    expect(keys(ordered)).toHaveLength(MODULES.length);
  });

  it("does not mutate the input array", () => {
    const before = keys(MODULES);
    orderModules(MODULES, ["trash", "spam"]);
    expect(keys(MODULES)).toEqual(before);
  });

  it("round-trips a single move-up, the way the settings arrows drive it", () => {
    const start = keys(MODULES);
    const from = start.indexOf("important");
    const moved = [...start];
    [moved[from - 1], moved[from]] = [moved[from], moved[from - 1]];
    expect(keys(orderModules(MODULES, moved))).toEqual(moved);
  });
});
