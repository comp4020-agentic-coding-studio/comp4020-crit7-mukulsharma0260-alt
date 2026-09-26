import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { type Assessment, type Course, assessments, courses, type Message, messages, planCourses } from "./schema";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");
// better-sqlite3 leaves FK enforcement off by default, which would make
// every `.references()` in schema.ts decorative only.
client.pragma("foreign_keys = ON");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

export type { Message };

export function listMessages(): Message[] {
  return db.select().from(messages).orderBy(desc(messages.id)).limit(50).all();
}

export function addMessage(body: string): Message {
  return db.insert(messages).values({ body }).returning().get();
}

export function listCourses(): Course[] {
  return db.select().from(courses).all();
}

export function listAssessments(): Assessment[] {
  return db.select().from(assessments).all();
}

export type Plan = { current: string[]; candidate: string | null };

// A single implicit user, so plan_courses holds exactly one plan: at most one
// 'candidate' row (courseId is its primary key) and any number of 'current'
// rows. Reload-and-restore just reads this table back.
export function getPlan(): Plan {
  const rows = db.select().from(planCourses).all();
  return {
    current: rows.filter((row) => row.role === "current").map((row) => row.courseId),
    candidate: rows.find((row) => row.role === "candidate")?.courseId ?? null,
  };
}

// Replaces the whole plan atomically: the delete and the re-insert happen in
// one transaction, so a reload never sees a half-written plan (empty, or a
// mix of the old and new selections).
export function savePlan(plan: Plan): void {
  db.transaction((tx) => {
    tx.delete(planCourses).run();
    for (const courseId of plan.current) {
      tx.insert(planCourses).values({ courseId, role: "current" }).run();
    }
    if (plan.candidate) {
      tx.insert(planCourses).values({ courseId: plan.candidate, role: "candidate" }).run();
    }
  });
}
