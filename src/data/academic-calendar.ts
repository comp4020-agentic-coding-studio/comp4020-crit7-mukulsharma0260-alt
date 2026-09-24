// The ANU Semester 2 2026 teaching-week calendar — a committed, ordered
// partition of the semester with NO gaps: each entry's endDate is the next
// entry's startDate, covering week 1's first day through the end of the exam
// period. This is the ANU-wide calendar (the numbering the six real courses'
// own assessment dates are stated against), not COMP4020's internal
// crit/assignment week numbering.
//
// Provenance is split across two sources, verified independently and
// cross-checked against each other rather than trusted from one place:
//
//   - Semester start/end, the teaching-break window, and the exam-period
//     window are `published` from ANU's own university-wide calendar:
//     https://www.anu.edu.au/directories/university-calendar?year=2026
//     (confirmed against the page's raw HTML, not a fetch-tool summary —
//     two summarised fetches of this URL disagreed with each other about
//     whether the break existed at all; only a direct read of the HTML
//     settled it: "07 Sep Teaching break commences", "21 Sep Return from
//     teaching break", "27 Jul Semester 2 begins", "30 Oct Semester 2 ends",
//     "05 Nov Semester 2 examination period begins", "21 Nov ... ends").
//   - The page above gives those boundary dates but never labels individual
//     "Week N"s. The week numbers here come from a second, independently
//     published ANU document — the CBE Student Engagement Planner:
//     https://cbe.anu.edu.au/files/2026-04/Student-Engagement-Planner-2026.pdf
//     which lays out "Semester 2 Week 1" on 27 Jul through "Week 12" on
//     26 Oct, with the two unlabelled weeks in between matching the break
//     dates above exactly. This is a college-produced document, not the
//     university-wide page — flagged here rather than silently treated as
//     the same source — but its week numbers are corroborated by the
//     independently-published boundary dates (each Monday lands exactly
//     where counting from 27 Jul, skipping the break, predicts), so this is
//     cross-validated `published` data, not this app's own guess.
//   - The single gap ANU's own calendar leaves unlabelled — the three days
//     between "Semester 2 ends" (30 Oct, a Friday) and "examination period
//     begins" (05 Nov, a Thursday) — has no ANU-given name in either source
//     (no "STUVAC"/"study period" text found on either page). Rather than
//     invent a label, it's kept as its own `kind: "other"` entry, sourced to
//     the same two published boundary facts that bound it.
//
// The bucketing rule (this part is a judgement call, not sourced from ANU):
//   - An assessment's due_at is bucketed into whichever entry's
//     [startDate, endDate) contains it — including 'break', 'exam' and
//     'other' entries. A big assessment landing in the break is real
//     information (a real clash with the break is exactly what this app
//     exists to surface) and stays under that entry's own label; it is never
//     folded into an adjacent numbered teaching week.
//   - A due_at outside the modelled range entirely (before week 1 starts,
//     after the exam period ends — a data error, not a real gap, since the
//     range above is contiguous) is not counted toward any bucket's total.
//     It must be flagged visibly wherever it's rendered, never silently
//     dropped or merged into the nearest week.
export type CalendarEntry = {
  kind: "teaching" | "break" | "exam" | "other";
  label: string;
  /** Only meaningful for kind: "teaching". */
  number?: number;
  /** ISO date, inclusive. */
  startDate: string;
  /** ISO date, exclusive — equal to the next entry's startDate. */
  endDate: string;
  sourceUrl: string;
};

const ANU_CALENDAR_URL =
  "https://www.anu.edu.au/directories/university-calendar?year=2026";
const CBE_PLANNER_URL =
  "https://cbe.anu.edu.au/files/2026-04/Student-Engagement-Planner-2026.pdf";

export const ACADEMIC_CALENDAR: CalendarEntry[] = [
  { kind: "teaching", number: 1, label: "Week 1", startDate: "2026-07-27", endDate: "2026-08-03", sourceUrl: CBE_PLANNER_URL },
  { kind: "teaching", number: 2, label: "Week 2", startDate: "2026-08-03", endDate: "2026-08-10", sourceUrl: CBE_PLANNER_URL },
  { kind: "teaching", number: 3, label: "Week 3", startDate: "2026-08-10", endDate: "2026-08-17", sourceUrl: CBE_PLANNER_URL },
  { kind: "teaching", number: 4, label: "Week 4", startDate: "2026-08-17", endDate: "2026-08-24", sourceUrl: CBE_PLANNER_URL },
  { kind: "teaching", number: 5, label: "Week 5", startDate: "2026-08-24", endDate: "2026-08-31", sourceUrl: CBE_PLANNER_URL },
  { kind: "teaching", number: 6, label: "Week 6", startDate: "2026-08-31", endDate: "2026-09-07", sourceUrl: CBE_PLANNER_URL },
  { kind: "break", label: "Mid-semester teaching break", startDate: "2026-09-07", endDate: "2026-09-21", sourceUrl: ANU_CALENDAR_URL },
  { kind: "teaching", number: 7, label: "Week 7", startDate: "2026-09-21", endDate: "2026-09-28", sourceUrl: CBE_PLANNER_URL },
  { kind: "teaching", number: 8, label: "Week 8", startDate: "2026-09-28", endDate: "2026-10-05", sourceUrl: CBE_PLANNER_URL },
  { kind: "teaching", number: 9, label: "Week 9", startDate: "2026-10-05", endDate: "2026-10-12", sourceUrl: CBE_PLANNER_URL },
  { kind: "teaching", number: 10, label: "Week 10", startDate: "2026-10-12", endDate: "2026-10-19", sourceUrl: CBE_PLANNER_URL },
  { kind: "teaching", number: 11, label: "Week 11", startDate: "2026-10-19", endDate: "2026-10-26", sourceUrl: CBE_PLANNER_URL },
  { kind: "teaching", number: 12, label: "Week 12", startDate: "2026-10-26", endDate: "2026-11-02", sourceUrl: CBE_PLANNER_URL },
  { kind: "other", label: "Between semester end and the exam period (not otherwise labelled by ANU)", startDate: "2026-11-02", endDate: "2026-11-05", sourceUrl: ANU_CALENDAR_URL },
  { kind: "exam", label: "Semester 2 examination period", startDate: "2026-11-05", endDate: "2026-11-22", sourceUrl: ANU_CALENDAR_URL },
];
