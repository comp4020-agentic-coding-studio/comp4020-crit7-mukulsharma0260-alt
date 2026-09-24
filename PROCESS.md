# Process overview

## What I built

This crit was setup rather than a feature build. My goal was to make the new full-stack/Fly environment reliable before I depended on it for later work.

I deliberately kept the supplied `template-dynamic` application unchanged. I did not want to add meaningless features simply to make the repository look busier. The visible starter is intentional: the work for this crit was getting the environment, deployment path and course tooling into a state I could trust.

My written Crit 7 reflection, including the breakthrough I am presenting in the crit, was added in [`4a59dcb`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mukulsharma0260-alt/commit/4a59dcb330586d83f8ae582023fe38fc3d62d2fc).

## How I got here

I treated the setup itself as something that needed verification rather than assuming that one successful command meant everything was ready. I installed the repository dependencies, restored the course Git-hook configuration, configured the Fly environment, deployed the supplied starter and confirmed that the live application responded successfully.

I then ran `/comp4020:doctor` as an independent final check. It finished with **22 pass, 0 warn, 0 fail**.

The important decision was restraint. I could have changed the starter simply to produce visible activity, but that would have confused setup work with design work. Instead, I left the application alone, verified the infrastructure directly and documented what I actually did.

The repository began from the course-provided starter commits [`80d6e1c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mukulsharma0260-alt/commit/80d6e1c85e3a84e2a86d821aa810f6056da7dc5b) and [`d07f6af`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mukulsharma0260-alt/commit/d07f6af0953ca1a2cb8aededecd3ebfeb6e13180). These identify the supplied baseline I intentionally preserved; I am not claiming them as work I performed.

## Design decisions — Clash

Decided before writing any of the data layer, so they'd survive a context
compaction rather than live only in a conversation.

- **The idea, and what it indicts.** `plan_courses` (current vs. candidate
  course, tagged by role) makes "what if I added this course" a database fact
  instead of a mental guess: the app compares my real semester's per-teaching-week
  assessment weight against that same semester plus one candidate, and shows the
  change to the worst week. It indicts finding out about an assessment clash
  the week it's due, instead of before the course is chosen.
- **Seed data ships as a migration, not a script.** Courses and assessments are
  reference data (ANU's own published Sem 2 2026 offerings), not user state —
  they belong on the same automatic path as the schema, landing on the Fly
  volume the moment it's created, with no separate seeding step to forget or
  re-run.
- **Seed data is hand-typed SQL, not a TS/JSON intermediate.** A typed source
  file would only ever be read by me, never by the running app — Drizzle's
  SQLite migrator executes `.sql` files only — so it would be a second copy of
  the same data with no runtime purpose, and second copies drift. A spec test
  (each course's assessment weights sum to ~100) recovers the safety net a
  typed file would have given at compile time.
- **`provenance_type` is an enum (`published` | `estimated`), never free text.**
  Every assessment's date and weight is either sourced from a real ANU page
  (`source_url` required) or my own placement, labelled as such. No third,
  unlabelled category.
- **No `estimated_hours` column.** The metric this app defends is assessment
  *weight* due in a week, not a workload guess. A workload estimate would be an
  invented, unsourced number in support of a claim the app doesn't make.
- **The bucketing rule.** The teaching-week calendar is one ordered partition
  with no gaps. An assessment due during the break or exam period is bucketed
  under that entry's own label — never folded into an adjacent numbered
  teaching week, since a real clash with the break is exactly what this app
  exists to surface. A due date outside the modelled calendar entirely is
  flagged visibly wherever it renders, never silently dropped or merged.
- **One candidate at a time.** `plan_courses` holds at most one row with
  `role = 'candidate'`; adding a second replaces the first. The comparison is
  "my semester, plus this one course" — two candidates make the delta
  ambiguous and the UI worse.
- **`plan_courses` has exactly one write path.** "Save to plan" is a role
  `UPDATE` (`candidate` → `current`), not an insert. Add-as-candidate,
  promote-to-current, and remove are the same operation with different
  arguments, never two separate write paths for one state transition.
- **Worst-week metric: max assessment weight due in any single bucket, ties go
  to the earlier bucket.** Nothing cleverer — no weighting by difficulty, no
  smoothing.
