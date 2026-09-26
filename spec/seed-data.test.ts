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

type CourseRow = { code: string; title: string; assessment_scope: string };
type AssessmentRow = {
  id: number;
  course_id: string;
  title: string;
  weight: number;
  weight_provenance: string;
  weight_source_url: string | null;
  due_at: string | null;
  due_week: number | null;
  due_timing_status: string;
  due_at_source_url: string | null;
  due_at_published_text: string | null;
};

const courses = db.prepare("SELECT code, title, assessment_scope FROM courses").all() as CourseRow[];
const assessments = db.prepare("SELECT * FROM assessments").all() as AssessmentRow[];

// ANU pages round percentages (three assessments at 33.3% never quite hits
// 100), but a real typo — a swapped digit, a forgotten assessment — misses by
// far more than rounding ever does. 0.5 is loose enough for the former, tight
// enough to still catch the latter.
const WEIGHT_TOLERANCE = 0.5;

const calendarStart = ACADEMIC_CALENDAR[0].startDate;
const calendarEnd = ACADEMIC_CALENDAR[ACADEMIC_CALENDAR.length - 1].endDate;
const TEACHING_WEEK_NUMBERS = ACADEMIC_CALENDAR.filter((e) => e.kind === "teaching").map((e) => e.number);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("seed data: courses", () => {
  it("has at least one course seeded", () => {
    expect(courses.length).toBeGreaterThan(0);
  });

  it.each(courses)("$code ($assessment_scope): assessment weights total is sane for its scope", (course) => {
    const rows = assessments.filter((a) => a.course_id === course.code);
    expect(rows.length, `${course.code} has no assessments`).toBeGreaterThan(0);
    const total = rows.reduce((sum, a) => sum + a.weight, 0);

    if (course.assessment_scope === "complete") {
      expect(
        Math.abs(total - 100),
        `${course.code} (complete) assessments sum to ${total}, not ~100`,
      ).toBeLessThanOrEqual(WEIGHT_TOLERANCE);
    } else if (course.assessment_scope === "partial_annual_slice") {
      // A single semester's slice of an annual 6+6 course is expected to
      // total less than 100 — that is real information (the rest of the
      // course's weight sits in the other semester), not a data error, so it
      // must never be padded with invented assessments to force 100.
      expect(total, `${course.code} (partial_annual_slice) total ${total} must be > 0`).toBeGreaterThan(0);
      expect(total, `${course.code} (partial_annual_slice) total ${total} must be <= 100`).toBeLessThanOrEqual(100);
    } else {
      throw new Error(`${course.code} has unknown assessment_scope '${course.assessment_scope}'`);
    }
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
    "$course_id / $title: weight_provenance is 'published' or 'estimated'",
    (a) => {
      expect(["published", "estimated"]).toContain(a.weight_provenance);
    },
  );

  it.each(assessments)(
    "$course_id / $title: due_timing_status is 'published', 'estimated' or 'unstated'",
    (a) => {
      expect(["published", "estimated", "unstated"]).toContain(a.due_timing_status);
    },
  );

  it.each(assessments)(
    "$course_id / $title: unstated timing has due_at, due_week and due_at_published_text all null",
    (a) => {
      if (a.due_timing_status !== "unstated") return;
      expect(a.due_at, `${a.course_id} / ${a.title} is unstated but has due_at`).toBeNull();
      expect(a.due_week, `${a.course_id} / ${a.title} is unstated but has due_week`).toBeNull();
      expect(
        a.due_at_published_text,
        `${a.course_id} / ${a.title} is unstated but has due_at_published_text`,
      ).toBeNull();
    },
  );

  it.each(assessments)(
    "$course_id / $title: published/estimated timing has at least one timing representation",
    (a) => {
      if (a.due_timing_status === "unstated") return;
      expect(
        a.due_at !== null || a.due_week !== null || a.due_at_published_text !== null,
        `${a.course_id} / ${a.title} is '${a.due_timing_status}' but due_at, due_week and due_at_published_text are all null`,
      ).toBe(true);
    },
  );

  it.each(assessments)("$course_id / $title: due_at, when set, is a real ISO date in the modelled calendar range", (a) => {
    if (a.due_at === null) return;
    expect(a.due_at, `${a.due_at} is not an ISO date (YYYY-MM-DD)`).toMatch(ISO_DATE);
    expect(!Number.isNaN(Date.parse(a.due_at)), `${a.due_at} does not parse as a date`).toBe(true);
    expect(
      a.due_at >= calendarStart && a.due_at < calendarEnd,
      `${a.due_at} falls outside the modelled calendar range [${calendarStart}, ${calendarEnd})`,
    ).toBe(true);
  });

  it.each(assessments)("$course_id / $title: due_week, when set, is a real teaching week in ACADEMIC_CALENDAR", (a) => {
    if (a.due_week === null) return;
    expect(
      TEACHING_WEEK_NUMBERS.includes(a.due_week),
      `${a.course_id} / ${a.title}: due_week ${a.due_week} is not one of ${TEACHING_WEEK_NUMBERS.join(", ")}`,
    ).toBe(true);
  });

  // Belt-and-braces: db.ts turns on `foreign_keys`, so a bad course_id should
  // already fail the INSERT itself at migration time. This is the visible,
  // named backstop for that pragma rather than the only thing enforcing it.
  it.each(assessments)("$course_id / $title: references a course that exists", (a) => {
    expect(courses.some((c) => c.code === a.course_id)).toBe(true);
  });
});
