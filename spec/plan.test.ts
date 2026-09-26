import Database from "better-sqlite3";
import { describe, expect, inject, it } from "vitest";

// Drives the running app over HTTP to check the fixed Crit 7 contract: a
// plan saved through /api/plan is really in SQLite, survives a fresh
// request the way a reload would, and bad input is rejected before it ever
// reaches the table. Reads back through a separate read-only connection to
// the same throwaway DB the server booted against, same pattern as
// spec/seed-data.test.ts.
const baseUrl = inject("baseUrl");
const db = new Database(inject("dbPath"), { readonly: true, fileMustExist: true });

type PlanRow = { course_id: string; role: string };

const post = (path: string, body: URLSearchParams) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body,
    redirect: "manual",
  });

const planRows = () => db.prepare("SELECT course_id, role FROM plan_courses").all() as PlanRow[];

describe("plan persistence", () => {
  it("saves a plan to SQLite", async () => {
    const res = await post(
      "/api/plan",
      new URLSearchParams([
        ["current", "COMP4020"],
        ["current", "COMP6120"],
        ["candidate", "COMP6390"],
      ]),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?saved=1");

    const rows = planRows();
    expect(rows.filter((r) => r.role === "current").map((r) => r.course_id).sort()).toEqual([
      "COMP4020",
      "COMP6120",
    ]);
    expect(rows.find((r) => r.role === "candidate")?.course_id).toBe("COMP6390");
  });

  it("reads the saved plan back on a fresh request, restored on the homepage", async () => {
    const res = await fetch(baseUrl);
    const html = await res.text();
    expect(html).toContain('value="COMP4020" checked');
    expect(html).toContain('value="COMP6120" checked');
    expect(html).toContain("COMP6390");
  });

  it("replacing the plan removes the stale selections atomically", async () => {
    await post("/api/plan", new URLSearchParams([["current", "COMP6390"]]));

    const rows = planRows();
    expect(rows).toEqual([{ course_id: "COMP6390", role: "current" }]);
  });

  it("rejects a candidate that duplicates a current course, leaving the stored plan untouched", async () => {
    const before = planRows();
    const res = await post(
      "/api/plan",
      new URLSearchParams([
        ["current", "COMP6390"],
        ["candidate", "COMP6390"],
      ]),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?error=candidate_conflict");
    expect(planRows()).toEqual(before);
  });

  it("rejects an unknown course code, leaving the stored plan untouched", async () => {
    const before = planRows();
    const res = await post("/api/plan", new URLSearchParams([["current", "COMP9999"]]));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?error=unknown_course");
    expect(planRows()).toEqual(before);
  });
});
