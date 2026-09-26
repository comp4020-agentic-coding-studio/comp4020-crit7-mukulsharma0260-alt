import { ACADEMIC_CALENDAR } from "../data/academic-calendar";
import type { Assessment } from "./schema";

// The metric this app exists to show: assessment WEIGHT due in a teaching
// week, not a workload guess (see schema.ts). due_week is only ever a
// numbered teaching week (see academic-calendar.ts) — never a break, exam or
// unlabelled-gap entry, since those have no `number` — so this list is
// exactly the weeks a bar can legitimately be drawn for.
const TEACHING_WEEK_NUMBERS = ACADEMIC_CALENDAR.filter((entry) => entry.kind === "teaching")
  .map((entry) => entry.number as number)
  .sort((a, b) => a - b);

export type WeekPressure = {
  week: number;
  label: string;
  currentTotal: number;
  withCandidateTotal: number;
};

// An assessment that belongs to a selected course but whose timing doesn't
// land in a numbered teaching week — an unstated timing, a published week our
// calendar doesn't model (e.g. "Week 13"), or a published date that falls in
// the exam period or the gap before it. Surfaced separately rather than
// dropped, so a real 45%-weighted exam never just vanishes from the page.
export type UnmappedAssessment = {
  courseId: string;
  title: string;
  weight: number;
  timingLabel: string;
};

export type PressureResult = {
  weeks: WeekPressure[];
  worstWeek: WeekPressure | null;
  unmapped: UnmappedAssessment[];
};

function sumWeight(rows: Assessment[], predicate: (row: Assessment) => boolean): number {
  return rows.filter(predicate).reduce((sum, row) => sum + row.weight, 0);
}

export function computeWeeklyPressure(
  allAssessments: Assessment[],
  currentCodes: string[],
  candidateCode: string | null,
): PressureResult {
  const currentSet = new Set(currentCodes);
  const relevant = allAssessments.filter(
    (a) => currentSet.has(a.courseId) || a.courseId === candidateCode,
  );

  const weeks: WeekPressure[] = [];
  for (const week of TEACHING_WEEK_NUMBERS) {
    const currentTotal = sumWeight(relevant, (a) => currentSet.has(a.courseId) && a.dueWeek === week);
    const candidateTotal = candidateCode
      ? sumWeight(relevant, (a) => a.courseId === candidateCode && a.dueWeek === week)
      : 0;
    const withCandidateTotal = currentTotal + candidateTotal;
    if (currentTotal > 0 || withCandidateTotal > 0) {
      weeks.push({ week, label: `Week ${week}`, currentTotal, withCandidateTotal });
    }
  }

  const worstWeek = weeks.reduce<WeekPressure | null>(
    (worst, week) => (!worst || week.withCandidateTotal > worst.withCandidateTotal ? week : worst),
    null,
  );

  const unmapped: UnmappedAssessment[] = relevant
    .filter((a) => a.dueWeek === null)
    .map((a) => ({
      courseId: a.courseId,
      title: a.title,
      weight: a.weight,
      timingLabel: a.dueAt ?? a.dueAtPublishedText ?? "Timing not published",
    }));

  return { weeks, worstWeek, unmapped };
}
