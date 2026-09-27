import { describe, expect, it } from "vitest";
import { computeAssessmentPressure } from "../src/lib/pressure";
import type { Assessment } from "../src/lib/schema";

// Pure-function test for the aggregation the whole app's headline number
// depends on: no DB, no HTTP — just known assessments in, known per-period
// totals out. Periods come from src/data/academic-calendar.ts, so a due_at
// can resolve to a numbered teaching week OR a break/exam/other entry.
function assessment(partial: Partial<Assessment> & Pick<Assessment, "courseId" | "title" | "weight">): Assessment {
  return {
    id: 0,
    weightProvenance: "published",
    weightSourceUrl: null,
    dueAt: null,
    dueWeek: null,
    dueTimingStatus: "published",
    dueAtSourceUrl: null,
    dueAtPublishedText: null,
    ...partial,
  };
}

const ROWS: Assessment[] = [
  assessment({ courseId: "COMP4020", title: "Assignment 1", weight: 20, dueWeek: 4 }),
  assessment({ courseId: "COMP6120", title: "Assignment 2", weight: 15, dueWeek: 5 }),
  assessment({ courseId: "COMP6120", title: "Final Exam", weight: 45, dueWeek: null, dueAtPublishedText: "Week 13" }),
  assessment({ courseId: "COMP6390", title: "Assignment 1", weight: 20, dueWeek: 5 }),
  assessment({ courseId: "COMP6390", title: "Assignment 2", weight: 30, dueWeek: 9 }),
];

describe("computeAssessmentPressure", () => {
  it("sums current-course weight for a known teaching week", () => {
    const result = computeAssessmentPressure(ROWS, ["COMP4020", "COMP6120"], null);
    const week5 = result.periods.find((p) => p.label === "Week 5");
    expect(week5?.currentTotal).toBe(15);
    expect(week5?.withCandidateTotal).toBe(15);
  });

  it("adds the candidate's weight on top of current for the same period", () => {
    const result = computeAssessmentPressure(ROWS, ["COMP4020", "COMP6120"], "COMP6390");
    const week5 = result.periods.find((p) => p.label === "Week 5");
    expect(week5?.currentTotal).toBe(15);
    expect(week5?.withCandidateTotal).toBe(35);
  });

  it("identifies the highest-pressure period by the highest with-candidate total", () => {
    const result = computeAssessmentPressure(ROWS, ["COMP4020", "COMP6120"], "COMP6390");
    expect(result.highestPressure?.label).toBe("Week 5");
    expect(result.highestPressure?.withCandidateTotal).toBe(35);
  });

  it("keeps assessments with no honest calendar mapping in unmapped, never dropped", () => {
    const result = computeAssessmentPressure(ROWS, ["COMP6120"], null);
    expect(result.unmapped).toHaveLength(1);
    expect(result.unmapped[0]).toMatchObject({
      courseId: "COMP6120",
      title: "Final Exam",
      weight: 45,
      timingLabel: "Week 13",
    });
  });

  // The bug an external review caught: a 40%-weighted final due in the exam
  // period was landing in "unmapped" because it has no due_week, even though
  // its due_at falls squarely inside the modelled exam-period calendar entry.
  it("maps a due_at in the exam period (2026-11-05) to the exam-period entry, not unmapped", () => {
    const rows = [assessment({ courseId: "COMP6390", title: "Final Project", weight: 40, dueAt: "2026-11-05" })];
    const result = computeAssessmentPressure(rows, ["COMP6390"], null);
    expect(result.unmapped).toHaveLength(0);
    const examPeriod = result.periods.find((p) => p.label === "Semester 2 examination period");
    expect(examPeriod?.kind).toBe("exam");
    expect(examPeriod?.currentTotal).toBe(40);
  });

  it("maps a due_at in the exam period (2026-11-09) to the exam-period entry, not unmapped", () => {
    const rows = [assessment({ courseId: "COMP4020", title: "Final Project", weight: 40, dueAt: "2026-11-09" })];
    const result = computeAssessmentPressure(rows, ["COMP4020"], null);
    expect(result.unmapped).toHaveLength(0);
    const examPeriod = result.periods.find((p) => p.label === "Semester 2 examination period");
    expect(examPeriod?.kind).toBe("exam");
    expect(examPeriod?.currentTotal).toBe(40);
  });

  it("treats a due_at genuinely outside the entire academic calendar as unmapped", () => {
    const rows = [
      assessment({ courseId: "COMP4020", title: "Late Resit", weight: 10, dueAt: "2027-02-01" }),
    ];
    const result = computeAssessmentPressure(rows, ["COMP4020"], null);
    expect(result.periods).toHaveLength(0);
    expect(result.unmapped).toHaveLength(1);
    expect(result.unmapped[0]).toMatchObject({ courseId: "COMP4020", title: "Late Resit", timingLabel: "2027-02-01" });
  });

  it("leaves genuinely unstated timing unresolved", () => {
    const rows = [
      assessment({ courseId: "COMP4020", title: "Studio Crit", weight: 20, dueAt: null, dueWeek: null }),
    ];
    const result = computeAssessmentPressure(rows, ["COMP4020"], null);
    expect(result.periods).toHaveLength(0);
    expect(result.unmapped).toEqual([
      { courseId: "COMP4020", title: "Studio Crit", weight: 20, timingLabel: "Timing not published" },
    ]);
  });

  it("leaves a published 'Week 13' unresolved rather than inventing a date", () => {
    const rows = [
      assessment({
        courseId: "COMP6120",
        title: "Final Exam",
        weight: 45,
        dueWeek: null,
        dueAt: null,
        dueAtPublishedText: "Week 13",
      }),
    ];
    const result = computeAssessmentPressure(rows, ["COMP6120"], null);
    expect(result.periods).toHaveLength(0);
    expect(result.unmapped).toEqual([
      { courseId: "COMP6120", title: "Final Exam", weight: 45, timingLabel: "Week 13" },
    ]);
  });
});
