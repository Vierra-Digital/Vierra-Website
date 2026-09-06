import { createRequire } from "node:module";
import { expect, it } from "vitest";
const require = createRequire(import.meta.url);
const { classify, extract } = require("../scripts/audit-cartography-all.cjs");
const { refine, csvCell } = require("../scripts/report-cartography-audit.cjs");

const company = { name: "Acme Inc.", address: "123 Main St, Austin, TX 78701" };
function result(name = "Acme Inc.", street = "123 Main St") {
  return { pages: [extract({ url: "https://acme.example/contact", html: `<script type="application/ld+json">${JSON.stringify({ "@type": "Organization", name, address: { streetAddress: street, addressLocality: "Austin", addressRegion: "TX", postalCode: "78701" } })}</script>` })] };
}
it("corroborates an exact organization and address match", () => {
  expect(classify(company, result()).status).toBe("address_corroborated_structured");
});
it("does not use a different organization's address", () => {
  expect(classify(company, result("Other Inc.")).status).toBe("identity_needs_review");
});
it("marks a different street for review rather than as verified", () => {
  expect(classify(company, result("Acme Inc.", "555 New St")).status).toBe("address_difference_needs_review");
});
it("recognizes formatting-only street differences", () => {
  expect(refine(classify(company, result("Acme Inc.", "123 Main Street"))).status).toBe("address_corroborated_formatting_difference");
});
it("does not treat a dead website as an invalid company", () => {
  expect(classify(company, { pages: [], errors: ["timeout"] }).status).toBe("website_unavailable");
});
it("escapes spreadsheet formula prefixes", () => {
  expect(csvCell("=1+1")).toBe('"\'=1+1"');
});
