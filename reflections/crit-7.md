# The database disagreed with my model

My breakthrough this week was realising that a schema is not just somewhere to put data — it is a claim about how the real system works.

I began CLASH with a tidy assumption: every assessment would have an exact due date, and every course would contribute 100% of its assessment weight inside one semester. That looked sensible until I checked the real ANU data. Some assessments published only a teaching week, some had no exact date, and COMP6120 even published "Week 13", which did not fit my numbered teaching-week model. Instead of inventing values to satisfy the schema, I changed the schema so published, estimated and unstated timing remained different states.

The tooling challenged the same habit. Drizzle generated a migration that looked plausible, but a fresh-database test showed it was copying columns that did not exist yet. I mapped the old schema to the new one explicitly and verified that existing rows would survive before accepting the migration.

I also corrected my own scope. I was turning a small crit into a much larger planning system. I cut it back to one defensible flow: select current courses, add one candidate, save the plan, reload, and see the same state plus the resulting assessment-pressure clash.

The finished prototype now persists the semester plan in SQLite and shows the worst teaching week without pretending assessment weight is the same thing as workload.

Before this crit, I often asked whether the agent could build what I described. Now I want to ask first: **what assumptions am I encoding, and what evidence would prove them wrong?**
