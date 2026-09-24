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
