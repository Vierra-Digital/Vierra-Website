import { describe, it, expect } from "vitest";
import { renderMergeTags } from "@/lib/campaigns/mergeTags";

const contact = {
  contact_first_name: "Alex",
  contact_last_name: "Rivera",
  contact_business: "Acme Co",
  contact_email: "alex@acme.co",
};

describe("renderMergeTags", () => {
  it("maps contact fields to the standard tokens", () => {
    expect(renderMergeTags("Hi {{firstName}} at {{company}}", contact)).toBe("Hi Alex at Acme Co");
    expect(renderMergeTags("{{lastName}} <{{email}}>", contact)).toBe("Rivera <alex@acme.co>");
  });

  it("builds fullName from first + last, skipping a missing last name", () => {
    expect(renderMergeTags("{{fullName}}", contact)).toBe("Alex Rivera");
    expect(
      renderMergeTags("{{fullName}}", { ...contact, contact_last_name: null })
    ).toBe("Alex");
  });

  it("honors fallbacks for empty fields", () => {
    expect(
      renderMergeTags("Hi {{firstName|there}}", { ...contact, contact_first_name: null })
    ).toBe("Hi there");
  });

  it("seeds spintax by email so a contact's variant is stable across renders", () => {
    const a = renderMergeTags("{Hi|Hey|Hello} {{firstName}}", contact);
    const b = renderMergeTags("{Hi|Hey|Hello} {{firstName}}", contact);
    expect(a).toBe(b);
    expect(["Hi Alex", "Hey Alex", "Hello Alex"]).toContain(a);
  });
});
