import { describe, expect, it } from "vitest";
import {
  isSafeEmailHref,
  stripRemoteUrlsFromStyle,
  UNSAFE_EMAIL_TAGS,
  UNSAFE_EMAIL_TAG_SELECTOR,
} from "@/lib/email/htmlSafety";

/**
 * These are the safety decisions the panel's inbound-email sanitizer makes. It walks a parsed DOM,
 * so it cannot be unit tested here directly; the decisions are extracted so they can be.
 *
 * Every case below was first confirmed against a real DOM in the browser, both failing before the
 * fix and passing after. The three that mattered:
 *   - a javascript: href survived, because the scheme was never checked — stripping on* handlers
 *     does nothing for a destination
 *   - background:url(...) survived, beaconing the reader's IP on render, which is the same signal
 *     the panel's tracking-pixel removal exists to withhold
 *   - a <form> with a password input survived, rendered inside the panel's own chrome
 */

describe("isSafeEmailHref", () => {
  it("keeps the schemes a real email link uses", () => {
    for (const href of [
      "https://vierradev.com/x",
      "http://example.com",
      "mailto:sam@acme.co",
      "tel:+15550100",
      "HTTPS://VIERRADEV.COM",
    ]) {
      expect(isSafeEmailHref(href), href).toBe(true);
    }
  });

  it("keeps relative, absolute-path, query and fragment links", () => {
    // These resolve against our own origin, which is where the reader already is.
    for (const href of ["/blog", "./x.html", "x.html", "?q=1", "#section", "//cdn.example.com/a"]) {
      expect(isSafeEmailHref(href), href).toBe(true);
    }
  });

  it("drops the schemes that execute or impersonate", () => {
    for (const href of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "vbscript:msgbox(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "blob:https://x/y",
      "jar:http://x!/y",
    ]) {
      expect(isSafeEmailHref(href), href).toBe(false);
    }
  });

  it("is not fooled by whitespace or control characters inside the scheme", () => {
    // A tab or newline inside the scheme navigates exactly the same, and is the standard way to
    // slip past a check that looks at the raw string. Built with fromCharCode so the bytes under
    // test are unambiguous in the source.
    const TAB = String.fromCharCode(9);
    const LF = String.fromCharCode(10);
    const CR = String.fromCharCode(13);
    const NUL = String.fromCharCode(0);
    const SOH = String.fromCharCode(1);

    const smuggled = [
      "java" + TAB + "script:alert(1)",
      "java" + LF + "script:alert(1)",
      "java" + CR + "script:alert(1)",
      LF + "javascript:alert(1)",
      TAB + "javascript:alert(1)",
      NUL + "javascript:alert(1)",
      SOH + "javascript:alert(1)",
      "  javascript:alert(1)",
    ];
    for (const href of smuggled) {
      expect(isSafeEmailHref(href), JSON.stringify(href)).toBe(false);
    }
  });

  it("treats an empty or whitespace-only href as unsafe rather than keeping it", () => {
    for (const href of ["", "   ", "\t", "\n"]) {
      expect(isSafeEmailHref(href), JSON.stringify(href)).toBe(false);
    }
  });

  it("does not mistake a colon inside a path for a scheme", () => {
    // A real URL can carry a colon in its path or query; that is not a scheme.
    for (const href of ["/a/b:c", "x.html?t=1:2", "#a:b"]) {
      expect(isSafeEmailHref(href), href).toBe(true);
    }
  });
});

describe("stripRemoteUrlsFromStyle", () => {
  it("drops any declaration that would fetch a remote resource", () => {
    for (const style of [
      "background:url(https://attacker.test/p)",
      "background-image:url(https://attacker.test/p)",
      "border-image:url(https://attacker.test/p)",
      "list-style-image:url(https://attacker.test/p)",
      "cursor:url(https://attacker.test/c), auto",
      "content:url(https://attacker.test/p)",
    ]) {
      expect(stripRemoteUrlsFromStyle(style), style).toBe("");
    }
  });

  it("is not fooled by case or spacing before the paren", () => {
    for (const style of [
      "background:URL(https://attacker.test/p)",
      "background:Url (https://attacker.test/p)",
      "background:url\t(https://attacker.test/p)",
      "background:url   (https://attacker.test/p)",
    ]) {
      expect(stripRemoteUrlsFromStyle(style), style).toBe("");
    }
  });

  it("keeps the formatting an email actually needs", () => {
    const style = "color:#fff;font-size:12px;text-align:center;font-weight:bold";
    expect(stripRemoteUrlsFromStyle(style)).toBe(
      "color:#fff; font-size:12px; text-align:center; font-weight:bold"
    );
  });

  it("removes only the offending declaration from a mixed style", () => {
    // Nuking the whole attribute would break legitimate formatting on a message that happens to
    // carry one remote background — the common case for marketing mail.
    expect(
      stripRemoteUrlsFromStyle("color:#fff;background:url(https://evil/p);font-size:9px")
    ).toBe("color:#fff; font-size:9px");
  });

  it("returns an empty string when nothing survives, so the caller can drop the attribute", () => {
    expect(stripRemoteUrlsFromStyle("")).toBe("");
    expect(stripRemoteUrlsFromStyle("   ")).toBe("");
    expect(stripRemoteUrlsFromStyle(";;;")).toBe("");
    expect(stripRemoteUrlsFromStyle("background:url(x);")).toBe("");
  });
});

describe("UNSAFE_EMAIL_TAGS", () => {
  it("covers the executing, embedding, form and animation elements", () => {
    for (const tag of [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "select",
      "textarea",
      "base",
      "link",
      "meta",
      "animate",
      "animateTransform",
      "animateMotion",
      "set",
    ]) {
      expect(UNSAFE_EMAIL_TAGS as readonly string[], tag).toContain(tag);
    }
  });

  it("keeps the formatting elements an email body is made of", () => {
    // Removing these would strip the message rather than sanitise it.
    for (const tag of ["div", "span", "p", "a", "img", "table", "tr", "td", "b", "i", "ul", "li", "svg"]) {
      expect(UNSAFE_EMAIL_TAGS as readonly string[], tag).not.toContain(tag);
    }
  });

  it("produces a selector querySelectorAll can take", () => {
    expect(UNSAFE_EMAIL_TAG_SELECTOR).toBe(UNSAFE_EMAIL_TAGS.join(", "));
    expect(UNSAFE_EMAIL_TAG_SELECTOR).toContain("script, style,");
    // No empty entries, which would make the whole selector invalid and throw at runtime.
    expect(UNSAFE_EMAIL_TAG_SELECTOR.split(", ").every((t) => t.length > 0)).toBe(true);
  });
});
