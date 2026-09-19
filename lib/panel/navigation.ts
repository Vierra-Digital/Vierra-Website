export const PANEL_SECTIONS: Record<number, string> = {
  0: "dashboard", 1: "clients", 2: "staff", 4: "ltv", 5: "marketing", 6: "projects",
  7: "blog", 8: "users", 9: "pdf", 10: "files", 11: "artemis", 12: "finances",
};
export function resolvePanelSection(value: unknown, role: "admin" | "staff") {
  const entry = Object.entries(PANEL_SECTIONS).find(([, name]) => name === value);
  const section = entry ? Number(entry[0]) : 0;
  // 12 (Finances) is admin-only for the same reason 8 and 9 are: it is company-wide money.
  const allowed = role === "admin" || ![8, 9, 11, 12].includes(section);
  return { section: allowed ? section : 0, invalid: Boolean(value) && (!entry || !allowed) };
}
