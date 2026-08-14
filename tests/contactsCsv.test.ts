import { describe, it, expect } from "vitest";
import { parseContactsCsvWithValidation, toContactsCsv } from "@/lib/contacts/csv";

describe("parseContactsCsvWithValidation — headers", () => {
  it("flags an empty CSV", () => {
    const r = parseContactsCsvWithValidation("   \n  ");
    expect(r.rows).toEqual([]);
    expect(r.headerErrors).toContain("CSV is empty.");
  });

  it("accepts the canonical headers with no errors", () => {
    const r = parseContactsCsvWithValidation("First Name,Last Name,Email,Phone,Business,Website,Address,Tags\nJane,Doe,jane@x.com,,,,,");
    expect(r.headerErrors).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });

  it("normalizes header case/whitespace and accepts aliases (first/company/url/tag)", () => {
    const r = parseContactsCsvWithValidation("  FIRST , email , Company , URL , TAG \nJane,jane@x.com,Acme,https://a.com,vip");
    expect(r.headerErrors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ firstName: "Jane", email: "jane@x.com", business: "Acme", website: "https://a.com", tags: "vip" });
  });

  it("reports each missing required header by its primary label", () => {
    const r = parseContactsCsvWithValidation("Last Name,Phone\nDoe,5551234567");
    expect(r.headerErrors).toContain('Missing required header "First Name".');
    expect(r.headerErrors).toContain('Missing required header "Email".');
  });

  it("reports duplicate headers", () => {
    const r = parseContactsCsvWithValidation("First Name,Email,Email\nJane,a@x.com,b@x.com");
    expect(r.headerErrors.some((e) => /Duplicate header .* appears 2 times\./.test(e))).toBe(true);
  });

  it("reports blank header columns with their 1-based position", () => {
    const r = parseContactsCsvWithValidation("First Name,,Email\nJane,x,jane@x.com");
    expect(r.headerErrors.some((e) => e.startsWith("Blank header column(s) at position(s): 2"))).toBe(true);
  });

  it("reports unsupported headers", () => {
    const r = parseContactsCsvWithValidation("First Name,Email,Nickname\nJane,jane@x.com,JJ");
    expect(r.headerErrors.some((e) => e.startsWith("Unsupported header column(s):") && e.includes("Nickname"))).toBe(true);
  });
});

describe("parseContactsCsvWithValidation — rows", () => {
  const header = "First Name,Last Name,Email,Phone,Business,Website,Address,Tags";

  it("lowercases email and assigns line numbers starting at 2", () => {
    const r = parseContactsCsvWithValidation(`${header}\nJane,Doe,JANE@X.COM,,,,,\nBob,Lee,BOB@X.COM,,,,,`);
    expect(r.rows[0]).toMatchObject({ email: "jane@x.com", lineNumber: 2 });
    expect(r.rows[1]).toMatchObject({ email: "bob@x.com", lineNumber: 3 });
  });

  it("parses a quoted field containing a comma as a single value", () => {
    const r = parseContactsCsvWithValidation(`${header}\nJane,Doe,jane@x.com,,"Acme, Inc",,,`);
    expect(r.rows[0].business).toBe("Acme, Inc");
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    const r = parseContactsCsvWithValidation(`${header}\nJane,Doe,jane@x.com,,"She said ""hi""",,,`);
    expect(r.rows[0].business).toBe('She said "hi"');
  });

  it("trims cell whitespace and leaves absent optional columns empty", () => {
    const r = parseContactsCsvWithValidation("First Name,Email\n  Jane  ,  jane@x.com  ");
    expect(r.rows[0]).toMatchObject({ firstName: "Jane", email: "jane@x.com", phone: "", business: "", tags: "" });
  });

  it("skips fully blank lines between rows", () => {
    const r = parseContactsCsvWithValidation("First Name,Email\nJane,jane@x.com\n\n\nBob,bob@x.com");
    expect(r.rows).toHaveLength(2);
  });
});

describe("toContactsCsv", () => {
  const row = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@x.com",
    phone: "5551234567",
    business: "Acme",
    website: "https://a.com",
    address: "1 St",
    tags: "vip",
  };

  it("emits a header row followed by quoted data cells", () => {
    const csv = toContactsCsv([row]);
    const [head, first] = csv.split("\n");
    expect(head).toBe("First Name,Last Name,Email,Phone,Business,Website,Address,Tags");
    expect(first.startsWith('"Jane","Doe","jane@x.com"')).toBe(true);
  });

  it("doubles embedded quotes when escaping", () => {
    const csv = toContactsCsv([{ ...row, business: 'Ac"me' }]);
    expect(csv).toContain('"Ac""me"');
  });

  it("round-trips ordinary data through parse (email already lowercase)", () => {
    const csv = toContactsCsv([row]);
    const parsed = parseContactsCsvWithValidation(csv);
    expect(parsed.headerErrors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@x.com",
      business: "Acme",
      website: "https://a.com",
      tags: "vip",
    });
  });

  it("neutralizes a formula-injection cell so it is not emitted as a bare formula", () => {
    const csv = toContactsCsv([{ ...row, business: "=1+1" }]);
    // guardSpreadsheetFormula prefixes risky leading chars; the raw cell must not start with =.
    expect(csv).not.toContain('"=1+1"');
    expect(csv).toContain("1+1");
  });
});
