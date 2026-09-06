export const PANEL_SECTIONS: Record<number, string> = {
  0: "dashboard", 1: "clients", 2: "staff", 4: "ltv", 5: "marketing", 6: "projects",
  7: "blog", 8: "users", 9: "pdf", 10: "files", 11: "artemis",
};
export function resolvePanelSection(value: unknown, role: "admin" | "staff") {
  const entry = Object.entries(PANEL_SECTIONS).find(([, name]) => name === value);
  const section = entry ? Number(entry[0]) : 0;
  const allowed = role === "admin" || ![8, 9, 11].includes(section);
  return { section: allowed ? section : 0, invalid: Boolean(value) && (!entry || !allowed) };
}
