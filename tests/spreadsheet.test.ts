import { describe, it, expect } from "vitest";
import { guardSpreadsheetFormula } from "@/lib/contacts/spreadsheet";

describe("guardSpreadsheetFormula (CSV/spreadsheet injection guard)", () => {
  it("prefixes cells starting with a formula trigger so Excel/Sheets render them as text", () => {
    expect(guardSpreadsheetFormula("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(guardSpreadsheetFormula("+1234567890")).toBe("'+1234567890");
    expect(guardSpreadsheetFormula("-2+3")).toBe("'-2+3");
    expect(guardSpreadsheetFormula("@import")).toBe("'@import");
    expect(guardSpreadsheetFormula("\ttabbed")).toBe("'\ttabbed");
    expect(guardSpreadsheetFormula("\rcarriage")).toBe("'\rcarriage");
  });

  it("leaves ordinary values untouched", () => {
    expect(guardSpreadsheetFormula("Acme Co")).toBe("Acme Co");
    expect(guardSpreadsheetFormula("alex@acme.co")).toBe("alex@acme.co");
    expect(guardSpreadsheetFormula("")).toBe("");
    // Only the LEADING character matters — an interior '=' is safe.
    expect(guardSpreadsheetFormula("a=b")).toBe("a=b");
  });
});
