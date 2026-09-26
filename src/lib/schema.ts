import { sql } from "drizzle-orm";
import { check, int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.
export const messages = sqliteTable("messages", {
  id: int().primaryKey({ autoIncrement: true }),
  body: text().notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Message = typeof messages.$inferSelect;

// Reference data: ANU's published Sem 2 2026 course/assessment structure.
// Seeded by a migration (drizzle/..._seed_courses.sql), never written by the
// app. `code` is the primary key — a natural, stable identifier — rather than
// a surrogate id, since assessments and plan_courses reference courses by
// code, and that's also what the hand-typed seed SQL reads by.
// assessment_scope distinguishes an ordinary semester offering ('complete',
// whose assessment weights should sum to ~100) from a single semester's slice
// of an annual 6+6 course ('partial_annual_slice', where a partial total is
// expected and correct, not an error) — a partial slice never gets padded
// with invented assessments to force it to 100.
export const courses = sqliteTable("courses", {
  code: text().primaryKey(),
  title: text().notNull(),
  units: int().notNull(),
  assessmentScope: text("assessment_scope", {
    enum: ["complete", "partial_annual_slice"],
  })
    .notNull()
    .default("complete"),
});

export type Course = typeof courses.$inferSelect;

// Reference data, seeded alongside courses. weight and due-timing each carry
// their OWN provenance/source_url pair, independently — the common real case
// is a course page that states the weight exactly but the date only as "week
// 9", so a single row-level label would force one of two dishonest choices:
// call the whole row 'published' (overclaiming the date) or 'estimated'
// (discarding the sourced weight, which is exactly the number this app's
// worst-week metric sums). Two labels means "40% — published" and "due date —
// estimated" render as two independently honest badges. 'published' rows must
// cite their own source_url (enforced by the CHECK below); 'estimated' rows
// are my own placement and may still carry a source_url — the page an
// estimate was informed by, not proof of the estimate itself.
//
// due-timing has three possible shapes, not two: a source can publish an
// exact calendar date (due_at), publish only a teaching week (due_week, e.g.
// COMP6120's class-schedule week labels with no structured due date field),
// or publish nothing at all about timing — which must be representable
// without inventing a date. due_timing_status names which of those three
// applies: 'published' or 'estimated' means at least one of due_at/due_week/
// due_at_published_text is populated; 'unstated' means the source said
// nothing and all three are null. (Named for what it governs jointly, not
// "due_at_provenance" — it can be 'published' while due_at itself is null.)
// due_at is an ISO date (no time-of-day: only the day matters for bucketing
// into a teaching week) or null. due_week is a teaching-week number or null;
// it is deliberately NOT constrained here to the current semester's week
// range (see src/data/academic-calendar.ts) — that range changes every
// semester and doesn't belong baked into the schema, so it's validated at the
// application/test layer instead. due_at_published_text is whatever ANU wrote
// about timing, verbatim, wherever it wrote anything at all — "Week 9",
// "mid-semester", "TBA" — null when the page says nothing. No
// estimated_hours column: the metric this app defends is assessment weight
// due in a week, not a workload guess.
export const assessments = sqliteTable(
  "assessments",
  {
    id: int().primaryKey({ autoIncrement: true }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.code),
    title: text().notNull(),
    weight: real().notNull(),
    weightProvenance: text("weight_provenance", {
      enum: ["published", "estimated"],
    }).notNull(),
    weightSourceUrl: text("weight_source_url"),
    dueAt: text("due_at"),
    dueWeek: int("due_week"),
    dueTimingStatus: text("due_timing_status", {
      enum: ["published", "estimated", "unstated"],
    }).notNull(),
    dueAtSourceUrl: text("due_at_source_url"),
    dueAtPublishedText: text("due_at_published_text"),
  },
  (table) => [
    check(
      "weight_published_requires_source_url",
      sql`${table.weightProvenance} != 'published' OR ${table.weightSourceUrl} IS NOT NULL`,
    ),
    check(
      "due_timing_published_requires_source_url",
      sql`${table.dueTimingStatus} != 'published' OR ${table.dueAtSourceUrl} IS NOT NULL`,
    ),
    check(
      "due_timing_unstated_is_fully_empty",
      sql`${table.dueTimingStatus} != 'unstated' OR (${table.dueAt} IS NULL AND ${table.dueWeek} IS NULL AND ${table.dueAtPublishedText} IS NULL)`,
    ),
    check(
      "due_timing_stated_has_something",
      sql`${table.dueTimingStatus} = 'unstated' OR (${table.dueAt} IS NOT NULL OR ${table.dueWeek} IS NOT NULL OR ${table.dueAtPublishedText} IS NOT NULL)`,
    ),
  ],
);

export type Assessment = typeof assessments.$inferSelect;

// Persistent user state — the only table the running app writes to, and the
// only one this app's "save to plan -> reload -> same plan" test exercises.
// course_id is the primary key (not just a column): with no auth and exactly
// one plan, a course is in the plan at most once, either current or
// candidate, never both — so every write ("add a candidate", "promote to
// current", "remove") is a plain keyed upsert/delete, never an
// application-level uniqueness check. Never seeded: populated entirely
// through the app's own add-to-plan UI.
export const planCourses = sqliteTable("plan_courses", {
  courseId: text("course_id")
    .primaryKey()
    .references(() => courses.code),
  role: text({ enum: ["current", "candidate"] }).notNull(),
});

export type PlanCourse = typeof planCourses.$inferSelect;
