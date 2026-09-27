# Process overview

## 1. What I built

**CLASH.**

Thesis: a course can fit your timetable and still not fit your semester.

CLASH is a thin slice of a real ANU system: it lets a student

- select their current courses,
- select one candidate course they're considering adding,
- save that semester plan to SQLite,
- reload the page and get the same plan back, and
- compare assessment weight by modelled semester period — numbered teaching
  weeks and explicitly modelled non-teaching periods like the exam period are
  both real buckets — current-only versus current-plus-candidate, and see the
  single highest-pressure period the candidate creates.

The metric the app reports is **assessment weight due in a week**, sourced
from each course's published ANU assessment breakdown — not an estimate of
workload hours. Weight and effort aren't the same thing, and the app never
claims otherwise.

## 2. Scope decision

The idea I started with risked becoming a full semester-planning system —
multiple candidates, timetable clash detection, workload estimation, maybe an
account per student. That's a semester of work, not a crit.

I deliberately cut it back to one end-to-end, crit-sized flow: select →
compare → save → reload → persist. No auth, no multiple users, no ANU API
integration or scraping, no AI/chat interface, no timetable replacement. This
was a deliberate scope correction made before writing the data layer, not
functionality I ran out of time to add.

## 3. Grounding in real ANU data

My first data model assumed every assessment would carry an exact due date,
and that every due date would fit a numbered teaching week. Checking the real
ANU assessment pages for COMP4020, COMP6120 and COMP6390 contradicted that:
some assessments publish only a week number with no date, some publish no
timing at all, and COMP6120 publishes its final exam timing as literally
"Week 13" — outside any numbered teaching week this app models.

Rather than inventing an exact date or a plausible-looking week number to
satisfy the original schema, I changed the schema so that `published`,
`estimated`, and `unstated` due-timing are distinct, honestly-labelled states,
and so an assessment with unmapped timing (like "Week 13") stays visible in
its own section instead of being forced into a bucket it doesn't belong in.

That schema and provenance work is
[`e20b0e7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mukulsharma0260-alt/commit/e20b0e73bcb411366bc5fb0e62d11f2e9496f59d)
(`data: support honest assessment timing`). The verified seed data for the
three demo courses, checked against ANU's published Sem 2 2026 offerings, is
[`a366d3e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mukulsharma0260-alt/commit/a366d3efb8d407f5bd1246f00c03b90fdc674eb3)
(`data: seed CLASH demo courses`).

## 4. Agent correction: a migration that was semantically wrong

While building the schema change above, Drizzle generated a migration that
looked plausible — it recreated the `assessments` table and reinserted the
existing rows. Testing it against a fresh database showed the generated
`INSERT ... SELECT` was reading columns from the old table that didn't exist
under the old schema; the recreate step would have silently dropped or
mismapped data on an existing volume.

I mapped the old-to-new columns explicitly by hand rather than accepting the
generated statement, and re-ran the migration against a database seeded with
an existing row to confirm it survived the migration intact before accepting
it. This is part of
[`e20b0e7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mukulsharma0260-alt/commit/e20b0e73bcb411366bc5fb0e62d11f2e9496f59d).

## 5. Design decisions — CLASH

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
- **`weight_provenance` is an enum (`published` | `estimated`), never free
  text.** Every assessment's date and weight is either sourced from a real ANU
  page (`weight_source_url` required) or my own placement, labelled as such. No
  third, unlabelled category.
- **No `estimated_hours` column.** The metric this app defends is assessment
  weight due in a week, not a workload guess. A workload estimate would be an
  invented, unsourced number in support of a claim the app doesn't make.
- **The bucketing rule.** The semester is one ordered, gapless partition
  (`ACADEMIC_CALENDAR`): numbered teaching weeks, the mid-semester break, the
  exam period, and the short unlabelled gap before it. An assessment is
  bucketed by whichever entry its timing actually falls in — a break or
  exam-period date is real information and stays under that entry's own
  label, never folded into an adjacent teaching week. Only genuinely
  unresolved timing, or a date outside the whole modelled range, is kept in an
  explicit unmapped section, since silently discarding or misplacing it is
  exactly the kind of error this app exists to avoid. (The first shipped
  implementation only matched a numbered `due_week` and dumped every other
  date into unmapped regardless of whether the calendar actually covered it —
  see [Post-ship review and correction](#8-post-ship-review-and-correction).)
- **One candidate at a time.** `plan_courses` holds at most one row with
  `role = 'candidate'`; adding a second replaces the first. The comparison is
  "my semester, plus this one course" — two candidates make the delta
  ambiguous and the UI worse.
- **Highest-pressure metric: max assessment weight due in any single bucket,
  ties go to the earlier bucket.** Nothing cleverer — no weighting by
  difficulty, no smoothing. A bucket can be a numbered teaching week or an
  explicitly modelled non-teaching period, such as the exam period.

## 6. The deploy health check was checking the wrong thing

Fly's default health signal is "is the port open." That check would have
passed on a broken migration: the Astro server binds the port regardless of
whether the database is usable, and `migrate()` only throws lazily, on the
first request that imports `src/lib/db.ts`. The machine would report healthy
in `flyctl status` while every page underneath it 500'd.

Two mechanical facts sit behind this:

- Drizzle's migrations run as one atomic batch against the whole pending set.
  On an existing volume, a bad migration rolls back only itself — it does not
  corrupt migrations that already applied cleanly.
- The server binds its port before migrations are even attempted, so "port
  open" and "database usable" are independent facts. A check that only tests
  the first tells you nothing about the second.

I did not find this by reading the config and reasoning about what it
covered. I found it by deliberately writing a malformed migration
(`drizzle/0002_healthcheck_test_broken.sql`, a course row with no matching
breakpoint) and deploying it, and watching `flyctl status` call the result
healthy.

The fix,
[`ff224cf`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mukulsharma0260-alt/commit/ff224cf217e2312f140c8c8910b3bd98acf7f860)
(`deploy: gate health check on a DB-touching route, not bare TCP`), is an
`[[http_service.checks]]` block against `/` rather than the service default.
`/` is the deliberate choice: it's the one route that reads the database, so a
migration failure fails *this* check instead of hiding behind a static route
that never touches the DB.

Then I broke it again on purpose, to confirm the fix actually does what I
claimed rather than trusting the config to be correct because it reads
correctly. `flyctl deploy` failed outright — `Unrecoverable error: timeout
reached waiting for health checks to pass for machine 890de5c6d56768` — not a
check that quietly reported unhealthy after the fact, but a rollout the
deploy command itself refused to complete. That finding is logged in
[`7b61cf9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mukulsharma0260-alt/commit/7b61cf9e085dec41136e038e7a05e1630cbf6d60)
(`docs: log the health-check-was-checking-the-wrong-thing finding`).

**The rule this is really about:** my last assignment's process write-up
ended on "a green check is not proof." This is the next step down from that —
a check I have never personally watched go red is not a check, it's a guess
that happens to be green. Writing the check is half the work; forcing it to
fail once, on purpose, for the reason I claim it exists, is the other half.
I had a check last week that stayed green for two days while blind to
exactly the failure it was supposed to catch, and I only noticed because I
went looking for something else.

Two practical consequences, noted for later rather than acted on now:

1. The check now gates the rollout, which is correct but not free: a broken
   deploy near a cutoff hangs for up to `flyctl deploy`'s `--wait-timeout`
   default of 5 minutes before failing, rather than failing fast.
2. `min_machines_running = 0` means the app scales to zero when idle, so the
   first request after a quiet period pays a cold start plus the check's
   10s grace period. Irrelevant while building; relevant when demoing — open
   the URL a minute before presenting rather than live.

## 7. The feature

[`67348a8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mukulsharma0260-alt/commit/67348a8204ed1e03c5b8d63aaf90135ff1ff43d9)
(`feat: persist semester plan and show assessment pressure`) is the
implementation itself:

- Persistence reuses the existing `plan_courses` table — no new migration was
  needed for this feature, since the table's role-based shape (`current` /
  `candidate`) already fit what the flow needed.
- Saving a plan replaces the stored plan atomically inside a single SQLite
  transaction: stale selections don't linger if the new set is smaller.
- The homepage reads the persisted plan from SQLite on every request. There is
  no `localStorage` or `sessionStorage` involved — a reload is a real
  round-trip through the database, not a client-side illusion of persistence.
- `/api/plan` validates on the server before writing: an unknown course code
  or a candidate that duplicates a current course is rejected with the stored
  plan left untouched, rather than silently accepted or crashing.
- The assessment-pressure calculation buckets each assessment against
  `ACADEMIC_CALENDAR` by its numbered teaching week when it has one, or by
  which calendar entry its exact due date falls inside otherwise — timing
  that's genuinely unstated, or outside the entire modelled calendar, is
  surfaced in an explicit unmapped section, never dropped and never guessed
  into a bucket. (This due-date-to-calendar-entry mapping was corrected
  post-ship; see [Post-ship review and correction](#8-post-ship-review-and-correction).)

**Demo scenario**, run against the seeded course data
(current: COMP4020, COMP6120; candidate: COMP6390): the overall
highest-pressure period is the **Semester 2 examination period** —
current-only weight due in that period is 40%, current plus the candidate is
80%, an increase of +40 percentage points. That's two 40%-weighted final
projects with exact due dates inside the modelled exam-period interval —
COMP4020's Final Project (`2026-11-09`) and COMP6390's Final Project
(`2026-11-05`) — each mapped there by due date rather than a numbered teaching
week. Week 5 is still a real, populated bucket in its own right (COMP6120's
Assignment 2 at 15% and COMP6390's Assignment 1 at 20%, for a with-candidate
total of 35%) — it's simply no longer the single highest-pressure period once
the exam period is bucketed correctly. Both figures are covered directly by
`spec/pressure.test.ts`.

## 8. Post-ship review and correction

After the first successful ship (repo public, CI green, live on Fly), the
deployed app was reviewed again. Three issues were reported; each was
reproduced independently before anything was changed — a review claim, like a
green check, isn't proof by itself.

- **Reported: the "About" nav link 404s at `/about`.** False positive. The
  actual link is `<a href="/readme/">About</a>`, and `/readme/` returns 200
  and always did — `/about` was never a real route, so there was nothing to
  fix there. What the review did surface honestly is that nothing was
  mechanically checking nav links at all, so `f092d32` adds
  `spec/nav.test.ts`, which reads every internal `nav a[href]` off the
  rendered homepage and asserts each one resolves with a 200.
- **Reported: assessment weight due in the exam period was being bucketed as
  "outside numbered teaching weeks."** Confirmed real. Two 40%-weighted final
  projects — COMP4020's Final Project (`2026-11-09`) and COMP6390's Final
  Project (`2026-11-05`) — have no numbered `due_week`, and the deployed
  pressure calculation only ever matched `due_week`, so both fell into the
  unmapped list even though both sit inside the modelled Semester 2
  examination-period interval. `f092d32` rewrites the aggregation so an exact
  `due_at` is matched against whichever `ACADEMIC_CALENDAR` entry contains it
  — teaching week, break, exam period, or the short unlabelled gap — under
  that entry's own label. Only a date outside the entire modelled calendar, or
  genuinely unstated timing (COMP6120's published "Week 13", which this app
  was never going to invent a date for), stays unmapped. No seeded date was
  changed.
- **Reported: the candidate/current selection in the form disagreed with the
  chart.** Diagnosed before changing anything: SQLite persistence and the
  rendered form were both already correct — the `checked`/`selected`
  attributes matched what `getPlan()` returned from the database. The chart
  reads from that same saved plan, so the actual disagreement a reviewer would
  see is that it can only ever show the last **saved** state, not in-progress
  checkbox edits, until a save-and-reload. `f092d32` adds the line "Showing
  your saved plan. Save changes to recalculate." directly above the chart,
  plus a small client-side script that stops a course from staying selectable
  as the candidate once it's checked under MY SEMESTER. Not a reactive
  frontend — the chart itself still only recalculates on save — and SQLite
  with server-side validation remains the sole authority.

[`f092d32`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-mukulsharma0260-alt/commit/f092d322519b271c6da8d812654d097c7136b00a)
(`fix: triage review findings and correct pressure bucketing`) is all three
fixes, together with the updated and expanded test suite backing them.

## 9. Verification

- 143/143 tests passing (`pnpm check`), 8 test files — up from 137/7 at
  feature completion, with the post-ship fix adding `spec/nav.test.ts` and
  five new calendar-bucketing cases to `spec/pressure.test.ts`.
- `pnpm check` (typecheck + build + full test suite) clean.
- `git diff --check` clean at each commit, including `f092d32`.
- Local: saved a plan through the running dev server, reloaded, confirmed the
  same current/candidate selections came back from SQLite — both before and
  after the post-ship fix.
- Deployed to Fly (`flyctl deploy --remote-only --ha=false -a
  comp4020-crit7-mukulsharma0260-alt`) and confirmed the live URL returns
  HTTP 200.
- Live: repeated the same save-then-reload check against the deployed app —
  the same current/candidate selections persisted across the request
  boundary, not just locally.
- Confirmed the live homepage serves CLASH (`<h1>CLASH</h1>`) and no longer
  serves the old Guestbook starter it replaced.
- Public CI run for `f092d32` (GitHub Actions run `36281424191`): both the
  `check` and `deploy` jobs passed, including CI's own live-site,
  live-update-stream, HTTPS-awareness, CSRF and internal-link checks.
- Live, post-fix verification against the deployed app: `/` returns 200 and
  serves CLASH; `/readme/` returns 200; every internal nav link resolves;
  both November finals (`2026-11-05`, `2026-11-09`) render under "Semester 2
  examination period" and neither appears in the unmapped list; COMP6120's
  published "Week 13" remains unresolved; a fresh save-then-reload of the demo
  plan persists correctly.

Live URL: https://comp4020-crit7-mukulsharma0260-alt.fly.dev

The repository is public and `/comp4020:ship` has run.

## 10. My role with the agent

I used the agent to implement quickly, but acceptance depended on evidence,
tests, source grounding, and correction, not on the agent's own account of
what it had done:

- Narrowed the scope myself when the idea started growing into a
  semester-planning system, before any data layer was written.
- Grounded the data model against the real ANU assessment pages for all three
  demo courses, rather than accepting a schema that assumed tidy exact dates.
- Rejected fabricated timing: an assessment that only publishes a week name
  like "Week 13" is represented as such, not converted into an invented exact
  date to fit the schema.
- Caught that a Drizzle-generated migration was semantically wrong by testing
  it against a fresh database rather than trusting that it applied without
  error.
- Corrected what the deploy health check was actually proving — port-open
  versus database-usable — by deliberately deploying a broken migration and
  watching the check pass anyway, then fixing it and deliberately breaking it
  again to confirm the fix really gates the rollout.
- Required persistence to be demonstrated through SQLite and a reload, both
  locally and against the live deploy, rather than accepting that a save
  request returning success was sufficient proof.
- Required assessments with unmappable timing to remain visible in an
  explicit section rather than being silently discarded or forced into the
  wrong week.
- Did not accept external review findings automatically after shipping: I
  reproduced each one, rejected the false `/about` claim, confirmed the
  calendar bug against the source model, diagnosed the form/chart behaviour
  before changing it, and only then implemented the smallest justified fixes.
