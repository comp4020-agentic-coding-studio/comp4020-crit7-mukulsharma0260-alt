import { describe, expect, it } from "vitest";
import { computeWeeklyPressure } from "../src/lib/pressure";
import type { Assessment } from "../src/lib/schema";

// Pure-function test for the aggregation the whole app's headline number
// depends on: no DB, no HTTP — just known assessments in, known per-week
// totals out.
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

describe("computeWeeklyPressure", () => {
  it("sums current-course weight for a known week", () => {
    const result = computeWeeklyPressure(ROWS, ["COMP4020", "COMP6120"], null);
    const week5 = result.weeks.find((w) => w.week === 5);
    expect(week5?.currentTotal).toBe(15);
    expect(week5?.withCandidateTotal).toBe(15);
  });

  it("adds the candidate's weight on top of current for the same week", () => {
    const result = computeWeeklyPressure(ROWS, ["COMP4020", "COMP6120"], "COMP6390");
    const week5 = result.weeks.find((w) => w.week === 5);
    expect(week5?.currentTotal).toBe(15);
    expect(week5?.withCandidateTotal).toBe(35);
  });

  it("identifies the worst week by the highest with-candidate total", () => {
    const result = computeWeeklyPressure(ROWS, ["COMP4020", "COMP6120"], "COMP6390");
    expect(result.worstWeek?.week).toBe(5);
    expect(result.worstWeek?.withCandidateTotal).toBe(35);
  });

  it("keeps assessments with no numbered teaching week in unmapped, never dropped", () => {
    const result = computeWeeklyPressure(ROWS, ["COMP6120"], null);
    expect(result.unmapped).toHaveLength(1);
    expect(result.unmapped[0]).toMatchObject({
      courseId: "COMP6120",
      title: "Final Exam",
      weight: 45,
      timingLabel: "Week 13",
    });
  });
});
