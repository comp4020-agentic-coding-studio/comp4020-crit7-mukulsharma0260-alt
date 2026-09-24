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
export const courses = sqliteTable("courses", {
  code: text().primaryKey(),
  title: text().notNull(),
  units: int().notNull(),
});

export type Course = typeof courses.$inferSelect;

// Reference data, seeded alongside courses. weight and due_at each carry
// their OWN provenance/source_url pair, independently — the common real case
// is a course page that states the weight exactly but the date only as "week
// 9", so a single row-level label would force one of two dishonest choices:
// call the whole row 'published' (overclaiming the date) or 'estimated'
// (discarding the sourced weight, which is exactly the number this app's
// worst-week metric sums). Two labels means "40% — published" and "due date —
// estimated" render as two independently honest badges. 'published' rows must
// cite their own source_url (enforced by the CHECK below); 'estimated' rows
// are my own placement and may still carry a source_url — the page an
// estimate was informed by, not proof of the estimate itself. due_at is an
// ISO date (no time-of-day: only the day matters for bucketing into a
// teaching week). due_at_published_text is whatever ANU wrote about timing,
// verbatim, wherever it wrote anything at all — "Week 9", "mid-semester",
// "TBA" — null when the page says nothing. It turns an 'estimated' due_at
// from a bare assertion into a derivation ("ANU says 'Week 9', placed Mon 5
// Oct") and is what a later sensitivity check reads to find the plausible
// window a placement was drawn from. No estimated_hours column: the metric
// this app defends is assessment weight due in a week, not a workload guess.
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
    dueAt: text("due_at").notNull(),
    dueAtProvenance: text("due_at_provenance", {
      enum: ["published", "estimated"],
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
      "due_at_published_requires_source_url",
      sql`${table.dueAtProvenance} != 'published' OR ${table.dueAtSourceUrl} IS NOT NULL`,
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
