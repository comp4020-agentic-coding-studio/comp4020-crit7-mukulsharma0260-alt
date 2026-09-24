# Your prototype

<!-- TEMPLATE: this file is yours, and the deployed app publishes it in full at
     /readme/ --- a visitor reads it before they touch the app, and so does the
     marker. Replace everything in it, this comment included. -->

What this is, in a paragraph: the thing, and what it's for.

## What good looks like here

Clash compares "my current semester" against "my current semester plus one
candidate course," per ANU teaching week, so a real assessment-weight clash is
visible before a course is chosen — not discovered the week it's due.

One judgement call worth stating explicitly here, since the rest of this
section will grow as the app does: **the teaching-week bucketing rule.**

- The semester calendar (`src/data/academic-calendar.ts`) is a single ordered
  partition with no gaps — every date from week 1's start through the end of
  the exam period belongs to exactly one entry, so a date can only fail to
  match if it falls entirely outside that modelled range.
- An assessment due during the mid-semester break or the exam period is
  bucketed under that entry's own label. It is never folded into an adjacent
  numbered teaching week — a real clash with the break is exactly the kind of
  thing this app exists to surface, not hide.
- An assessment whose due date falls outside the modelled range entirely (a
  data error, not a real gap) is never silently dropped or merged into the
  nearest week — it is flagged visibly wherever it renders.

Every assessment's date and weight is either `published` (sourced from ANU's
own pages, with a `source_url`) or `estimated` (my own placement, labelled as
such). Nothing is presented as fact without one of those two labels.

Images go in `public/` and are linked relatively --- `![alt](public/before.png)`
--- which renders on GitHub and at `/readme/` alike.
