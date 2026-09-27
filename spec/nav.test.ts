import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// An external review claimed the homepage's "About" link points to /about,
// which 404s. It doesn't — the link points to /readme/ — but the review was
// only wrong by luck: nothing was actually checking nav hrefs resolve. This
// reads the real hrefs out of the rendered homepage nav and fetches each one,
// so a future link rot (or another incorrect report) is caught mechanically
// rather than by manual spot-checking.
const baseUrl = inject("baseUrl");

describe("homepage nav", () => {
  it("every internal nav link resolves", async () => {
    const res = await fetch(baseUrl);
    const dom = new JSDOM(await res.text());
    const links = [...dom.window.document.querySelectorAll("nav a[href]")].map(
      (a) => a.getAttribute("href") as string,
    );
    const internal = links.filter((href) => href.startsWith("/"));
    expect(internal.length, "expected at least one internal nav link").toBeGreaterThan(0);

    for (const href of internal) {
      const linkRes = await fetch(new URL(href, baseUrl));
      expect(linkRes.status, `nav link ${href} should resolve`).toBe(200);
    }
  });
});
