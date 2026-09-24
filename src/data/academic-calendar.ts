// The ANU Semester 2 2026 teaching-week calendar — a committed, ordered
// partition of the semester with NO gaps: each entry's endDate is the next
// entry's startDate, covering week 1's first day through the end of the exam
// period. This is the ANU-wide calendar (the numbering the six real courses'
// own assessment dates are stated against), not COMP4020's internal
// crit/assignment week numbering.
//
// Dates are `published`, sourced from the ANU academic calendar — see each
// entry's sourceUrl — never estimated.
//
// The bucketing rule (this part is a judgement call, not sourced from ANU):
//   - An assessment's due_at is bucketed into whichever entry's
//     [startDate, endDate) contains it — including 'break' and 'exam'
//     entries. A big assessment landing in the break is real information
//     (a real clash with the break is exactly what this app exists to
//     surface) and stays under that entry's own label; it is never folded
//     into an adjacent numbered teaching week.
//   - A due_at outside the modelled range entirely (before week 1 starts,
//     after the exam period ends — a data error, not a real gap, since the
//     range above is contiguous) is not counted toward any bucket's total.
//     It must be flagged visibly wherever it's rendered, never silently
//     dropped or merged into the nearest week.
export type CalendarEntry = {
  kind: "teaching" | "break" | "exam";
  label: string;
  /** Only meaningful for kind: "teaching". */
  number?: number;
  /** ISO date, inclusive. */
  startDate: string;
  /** ISO date, exclusive — equal to the next entry's startDate. */
  endDate: string;
  sourceUrl: string;
};

// Filled in with the real ANU Semester 2 2026 dates in the next step.
export const ACADEMIC_CALENDAR: CalendarEntry[] = [];
