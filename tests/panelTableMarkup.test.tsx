import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PanelTable,
  PanelTbody,
  PanelTd,
  PanelTh,
  PanelThead,
  PanelTr,
} from "@/components/panel/PanelTable";

/**
 * The billing tables rendered with their headings not above their columns, and the cause was in
 * the markup rather than in any CSS: PanelThead wrapped its children in a `<tr>` of its own while
 * PanelTbody did not, so a call site that wrote `<PanelThead><PanelTr>…` — which four of the five
 * did, matching the tbody they had just written — produced `<tr><tr><th>`.
 *
 * A nested row is invalid HTML. The browser's table fixup then sized the header cells
 * independently of the body: measured in the running page, the header strip came out 631px wide
 * against a 1344px body row, and React logged "In HTML, <tr> cannot be a child of <tr>".
 *
 * These render the primitives the way the call sites use them and read the markup back, so the
 * asymmetry cannot return unnoticed.
 */

const table = (
  <PanelTable>
    <PanelThead>
      <PanelTr>
        <PanelTh>Invoice</PanelTh>
        <PanelTh className="!text-right">Amount</PanelTh>
      </PanelTr>
    </PanelThead>
    <PanelTbody>
      <PanelTr>
        <PanelTd>INV-1</PanelTd>
        <PanelTd className="text-right">$2,500.00</PanelTd>
      </PanelTr>
      <PanelTr>
        <PanelTd>INV-2</PanelTd>
        <PanelTd className="text-right">$1,200.00</PanelTd>
      </PanelTr>
    </PanelTbody>
  </PanelTable>
);

const html = renderToStaticMarkup(table);

describe("panel table markup", () => {
  it("never nests one row inside another", () => {
    // The exact defect. `<tr><tr` is the shape the browser had to repair.
    expect(html).not.toMatch(/<tr[^>]*>\s*<tr/);
  });

  it("gives the header exactly one row", () => {
    const thead = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    expect(thead.match(/<tr/g) ?? []).toHaveLength(1);
  });

  it("puts every heading in that row", () => {
    // `<th[\s>]` rather than `<th`, which also matches the <thead> opening it.
    const thead = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    expect(thead.match(/<th[\s>]/g) ?? []).toHaveLength(2);
  });

  it("keeps the header and body cell counts equal, which is what makes columns line up", () => {
    const thead = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    const tbody = html.slice(html.indexOf("<tbody"), html.indexOf("</tbody>"));
    const headers = (thead.match(/<th[\s>]/g) ?? []).length;
    const firstRow = tbody.slice(0, tbody.indexOf("</tr>"));
    expect((firstRow.match(/<td[\s>]/g) ?? []).length).toBe(headers);
  });

  it("does not put a row inside the table without a section", () => {
    // A stray `<tr>` between <table> and <thead> would be hoisted into its own anonymous section
    // and produce the same independent sizing.
    const between = html.slice(html.indexOf("<table"), html.indexOf("<thead"));
    expect(between).not.toContain("<tr");
  });

  it("hovers data rows only, not the header row", () => {
    // The hover moved from PanelTr to PanelTbody when PanelTr stopped being header-or-body
    // specific; a header row lighting up under the cursor reads as clickable.
    const thead = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    const tbody = html.slice(html.indexOf("<tbody"));
    // The class is an arbitrary variant, so it arrives HTML-escaped: [&gt;tr:hover]:bg-[...].
    expect(thead).not.toContain(":hover");
    expect(tbody).toContain("tr:hover]:bg-[#F9F7FD]");
  });

  it("right-aligns a heading and its column together", () => {
    const thead = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    // !text-right is needed on the th because PanelTh bakes in text-left.
    expect(thead).toContain("!text-right");
    expect(html.slice(html.indexOf("<tbody"))).toContain("text-right");
  });
});

describe("PanelThead on its own", () => {
  it("does not invent a row for cells handed to it directly", () => {
    // If it did, a call site following the tbody pattern would get two rows again.
    const bare = renderToStaticMarkup(
      <table>
        <PanelThead>
          <PanelTr>
            <PanelTh>Only</PanelTh>
          </PanelTr>
        </PanelThead>
      </table>
    );
    expect((bare.match(/<tr/g) ?? []).length).toBe(1);
  });
});
