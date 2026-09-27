import { ACADEMIC_CALENDAR, type CalendarEntry } from "../data/academic-calendar";
import type { Assessment } from "./schema";

// The metric this app exists to show: assessment WEIGHT due in a semester
// period, not a workload guess (see schema.ts). A "period" is whatever
// ACADEMIC_CALENDAR entry an assessment's timing resolves to — a numbered
// teaching week, the mid-semester break, the exam period, or the unlabelled
// gap before it. Bucketing by calendar entry (not just numbered week) is the
// documented rule in README.md: a break/exam-period date is real information
// and stays under that entry's own label, never folded into an adjacent week.
export type PeriodPressure = {
  /** The calendar entry's startDate — a stable identity even for two entries
   *  that could share a label, and unlike `label` never needs parsing. */
  key: string;
  label: string;
  kind: CalendarEntry["kind"];
  currentTotal: number;
  withCandidateTotal: number;
};

// An assessment that belongs to a selected course but whose timing can't be
// honestly placed on the calendar at all: no due_week, no due_at (genuinely
// unstated — e.g. a published-but-dateless "Week 13"), or a due_at that falls
// outside the entire modelled calendar range (a data error, not a real
// period). Surfaced separately rather than dropped or guessed into a bucket.
export type UnmappedAssessment = {
  courseId: string;
  title: string;
  weight: number;
  timingLabel: string;
};

export type PressureResult = {
  periods: PeriodPressure[];
  highestPressure: PeriodPressure | null;
  unmapped: UnmappedAssessment[];
};

// Rule A: a numbered due_week always wins when present, and always means a
// real teaching week (see academic-calendar.ts) — never a break/exam/other
// entry, since only teaching entries carry a `number`.
function entryForWeek(dueWeek: number): CalendarEntry | null {
  return ACADEMIC_CALENDAR.find((entry) => entry.kind === "teaching" && entry.number === dueWeek) ?? null;
}

// Rule B/C: an exact due_at is bucketed by whichever calendar entry's
// [startDate, endDate) contains it, whatever that entry's kind. A due_at that
// matches no entry is, by construction, outside the whole contiguous
// calendar range — rule C's "outside the model" case.
function entryForDate(dueAt: string): CalendarEntry | null {
  return ACADEMIC_CALENDAR.find((entry) => dueAt >= entry.startDate && dueAt < entry.endDate) ?? null;
}

// Rule D/E: no due_week and no due_at (or a due_week/due_at that resolves to
// nothing) leaves the assessment genuinely unresolved rather than guessed.
function entryFor(assessment: Assessment): CalendarEntry | null {
  if (assessment.dueWeek !== null) {
    return entryForWeek(assessment.dueWeek);
  }
  if (assessment.dueAt !== null) {
    return entryForDate(assessment.dueAt);
  }
  return null;
}

export function computeAssessmentPressure(
  allAssessments: Assessment[],
  currentCodes: string[],
  candidateCode: string | null,
): PressureResult {
  const currentSet = new Set(currentCodes);
  const relevant = allAssessments
    .filter((a) => currentSet.has(a.courseId) || a.courseId === candidateCode)
    .map((assessment) => ({ assessment, entry: entryFor(assessment) }));

  const periods: PeriodPressure[] = [];
  for (const entry of ACADEMIC_CALENDAR) {
    const inEntry = relevant.filter((r) => r.entry === entry);
    const currentTotal = inEntry
      .filter((r) => currentSet.has(r.assessment.courseId))
      .reduce((sum, r) => sum + r.assessment.weight, 0);
    const candidateTotal = candidateCode
      ? inEntry
          .filter((r) => r.assessment.courseId === candidateCode)
          .reduce((sum, r) => sum + r.assessment.weight, 0)
      : 0;
    const withCandidateTotal = currentTotal + candidateTotal;
    if (currentTotal > 0 || withCandidateTotal > 0) {
      periods.push({ key: entry.startDate, label: entry.label, kind: entry.kind, currentTotal, withCandidateTotal });
    }
  }

  const highestPressure = periods.reduce<PeriodPressure | null>(
    (highest, period) => (!highest || period.withCandidateTotal > highest.withCandidateTotal ? period : highest),
    null,
  );

  const unmapped: UnmappedAssessment[] = relevant
    .filter((r) => r.entry === null)
    .map(({ assessment }) => ({
      courseId: assessment.courseId,
      title: assessment.title,
      weight: assessment.weight,
      timingLabel: assessment.dueAtPublishedText ?? assessment.dueAt ?? "Timing not published",
    }));

  return { periods, highestPressure, unmapped };
}
