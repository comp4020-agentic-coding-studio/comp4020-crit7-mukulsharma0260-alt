import Database from "better-sqlite3";
import { describe, expect, inject, it } from "vitest";
import { ACADEMIC_CALENDAR } from "../src/data/academic-calendar";

// Asserts the FAULT this app can't afford, not the examples typed so far:
// a wrong weight silently produces a wrong worst week, the app's headline
// number. Written before a single course exists, so it starts red — there
// are no courses — and goes green one course at a time as they're seeded,
// naming which course is wrong the moment it's wrong rather than after all
// six are in.
//
// Reads the SAME throwaway database the running server booted against
// (spec/global-setup.ts exposes its path) — a read-only connection opened
// once the server is confirmed up, so migrations have already applied.
const db = new Database(inject("dbPath"), { readonly: true, fileMustExist: true });

type CourseRow = { code: string; title: string };
type AssessmentRow = {
  id: number;
  course_id: string;
  title: string;
  weight: number;
  weight_provenance: string;
  weight_source_url: string | null;
  due_at: string;
  due_at_provenance: string;
  due_at_source_url: string | null;
};

const courses = db.prepare("SELECT code, title FROM courses").all() as CourseRow[];
const assessments = db.prepare("SELECT * FROM assessments").all() as AssessmentRow[];

// ANU pages round percentages (three assessments at 33.3% never quite hits
// 100), but a real typo — a swapped digit, a forgotten assessment — misses by
// far more than rounding ever does. 0.5 is loose enough for the former, tight
// enough to still catch the latter.
const WEIGHT_TOLERANCE = 0.5;

const calendarStart = ACADEMIC_CALENDAR[0].startDate;
const calendarEnd = ACADEMIC_CALENDAR[ACADEMIC_CALENDAR.length - 1].endDate;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("seed data: courses", () => {
  it("has at least one course seeded", () => {
    expect(courses.length).toBeGreaterThan(0);
  });

  it.each(courses)(`$code: assessment weights sum to 100 (±${WEIGHT_TOLERANCE})`, (course) => {
    const rows = assessments.filter((a) => a.course_id === course.code);
    expect(rows.length, `${course.code} has no assessments`).toBeGreaterThan(0);
    const total = rows.reduce((sum, a) => sum + a.weight, 0);
    expect(
      Math.abs(total - 100),
      `${course.code} assessments sum to ${total}, not ~100`,
    ).toBeLessThanOrEqual(WEIGHT_TOLERANCE);
  });
});

describe("seed data: assessments", () => {
  // it.each over an empty array registers zero tests, which vitest reports as
  // a bare "no test found in suite" failure — a real signal (no assessments
  // yet) but a confusing one. Say so explicitly instead; "has at least one
  // course seeded" above is already the assertion that the empty state fails.
  if (assessments.length === 0) {
    it.skip("no assessments seeded yet", () => {});
    return;
  }

  it.each(assessments)(
    "$course_id / $title: provenance fields are 'published' or 'estimated'",
    (a) => {
      expect(["published", "estimated"]).toContain(a.weight_provenance);
      expect(["published", "estimated"]).toContain(a.due_at_provenance);
    },
  );

  it.each(assessments)("$course_id / $title: due_at is a real ISO date in the modelled calendar range", (a) => {
    expect(a.due_at, `${a.due_at} is not an ISO date (YYYY-MM-DD)`).toMatch(ISO_DATE);
    expect(!Number.isNaN(Date.parse(a.due_at)), `${a.due_at} does not parse as a date`).toBe(true);
    expect(
      a.due_at >= calendarStart && a.due_at < calendarEnd,
      `${a.due_at} falls outside the modelled calendar range [${calendarStart}, ${calendarEnd})`,
    ).toBe(true);
  });

  // Belt-and-braces: db.ts turns on `foreign_keys`, so a bad course_id should
  // already fail the INSERT itself at migration time. This is the visible,
  // named backstop for that pragma rather than the only thing enforcing it.
  it.each(assessments)("$course_id / $title: references a course that exists", (a) => {
    expect(courses.some((c) => c.code === a.course_id)).toBe(true);
  });
});
