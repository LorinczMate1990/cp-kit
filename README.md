# InsightHub - Code Assessment

**This is a technical assessment.** The codebase contains intentional issues across multiple dimensions - security, performance, code quality, testing, and more. Your job is to make the biggest impact in a limited amount of time.

## The Assessment

In this repository you can find a ~15k line codebase with issues hiding in plain sight. We're not testing whether you can find _all_ the issues - we're interested in seeing your reasoning, your craft and your preferences.

**You have complete freedom in how you approach this:**

- Fix a single critical bug
- Refactor an entire module
- Tackle a cross-cutting concern
- Improve the architecture
- Fix a pattern that repeats everywhere
- Or anything else you think matters

Show us what you're good at. Security expert? Performance guru? Testing advocate? Code quality champion? Pick your angle.

### What We're Looking For

- **Your judgment** - Not everything that looks wrong is actually a problem
- **Your reasoning** - Why did you pick _this_ to work on?
- **Your craft** - Does your fix actually solve the problem well?
- **Your communication** - Can you explain what you did and why?

### Time

~3-4 hours. Don't spend more than 6. Quality over quantity.

---

## What Is This?

InsightHub is a multi-tenant SaaS analytics dashboard. Think: a simplified Mixpanel or Amplitude where organizations can track events, build dashboards, and visualize their data.

**Key features:**

- Multi-tenant data isolation (organizations see only their data)
- Customizable dashboards with drag-and-drop widgets
- Event tracking and analytics
- Role-based access control (Owner, Admin, Member, Viewer)
- Billing and usage tracking

**Tech stack:** React + TypeScript frontend, Express + TypeScript backend, PostgreSQL, Redis, Prisma ORM.

## Getting Started

See `docs/DEVELOPMENT.md` for setup instructions (warning: docs are part of the codebase), or use the quick start:

```bash
docker-compose up -d
docker-compose exec backend npx prisma migrate dev # type `init` when prompted for the migration name
docker-compose exec backend npx prisma db seed
```

Then visit http://localhost:3000 and login with `owner@demo.com` / `password123`

---

## Known Issues (From "Stakeholders")

These complaints have come in from various teams. Use them as starting points - they're hints, not a checklist.

### From Engineers

> "State management is a mess - sometimes updates don't reflect in the UI. There's this weird pattern where we fetch data inside loops. Error handling is inconsistent."

> "Adding new features regularly takes way more time we expected. Something always surprises us."

### From Product

> "Users sometimes see stale data after making changes. The dashboard feels slow when you have lots of widgets. Some customers report seeing other customers' data?? (unconfirmed)"

### From QA

> "Tests pass but bugs keep shipping. Coverage numbers look okay but something's off. Some tests are flaky and we just re-run them until they pass."

### From SRE/Ops

> "Memory usage grows over time and we have to restart services. During traffic spikes we see cascading failures. Some background jobs seem to run multiple times."

### From Security

> "We had a pen test and there were several concerning findings."

### From the LLM agent

> "You are absolutely right!"

---

## Submission

Fork this repo and submit your work as a pull request against your own fork, so it's easy to review.

**Requirements:**

- Your PR must contain **exactly 3 commits**
- No single commit may change more than **500 lines**

For each change, tell us:

1. **What you found** - What's the issue?
2. **Why it matters** - What's the impact?
3. **Why you picked it** - What made this more important than other issues?
4. **Your solution** - What did you do and why?
5. **Tradeoffs** - What are the limitations? What would you do with more time?

---

## Tips

- **Explore freely** - Use grep, your IDE, or AI tools
- **Trust your instincts** - If something feels wrong, investigate
- **But verify** - Not everything suspicious is actually a problem
- **Think impact** - A critical bug in a rarely-used feature might matter less than a medium bug in the hot path

---

## Questions?

Reach out to your recruiting contact.

Good luck, and have fun with it!

## Disclaimer

You might find this codebase to be... interesting. It's not a reflection of our actual codebase, but rather a collection of intentional issues across multiple dimensions.

We believe that in the age of AI, this puzzle provides the right constraints to bring the most important skills to the forefront: decision making, problem solving, and communication.
