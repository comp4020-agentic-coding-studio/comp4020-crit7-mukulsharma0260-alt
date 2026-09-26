import { describe, expect, inject, it } from "vitest";

// The one homepage-content assertion the spec asks for: "/" is CLASH now,
// not the Guestbook starter it replaced.
const baseUrl = inject("baseUrl");

describe("homepage", () => {
  it("renders CLASH, not the Guestbook starter", async () => {
    const html = await (await fetch(baseUrl)).text();
    expect(html).toContain("<h1>CLASH</h1>");
    expect(html).not.toContain("Guestbook");
  });
});
