# Contributing to Remotify

Thanks for helping build the honest auto-apply pipeline. This guide keeps
contributions consistent with how the codebase is engineered.

## Development setup

1. Fork and clone, then `npm install`.
2. Copy `.env.example` to `.env` and fill in at minimum `DATABASE_URL`
   (free [Neon](https://neon.tech) works) and `APPLY_WORKER_SECRET`.
3. `npx prisma db push && npx prisma generate`
4. `npm run profile:seed:demo` to load the demo candidate profile.
5. `npm run dev` and open http://localhost:3000.

Useful verification commands:

| Command | Checks |
| --- | --- |
| `npm run lint` | ESLint over the whole repo |
| `npm run build` | Production Next.js build |
| `npm run test:scrapers` | Live run of every job source (network) |
| `node src/scripts/system-health.js` | End-to-end: resume, profile, AI, queue |

## Architecture ground rules

- **Plain JavaScript ESM only** — no TypeScript sources.
- **Thin route handlers** — business logic lives in `src/services/`.
- **Zod at the boundary** — validate external payloads (scraper output,
  API request bodies) before persistence.
- **Brain/hands split** — Vercel runs the queue and tracking ("brain");
  Playwright form-filling runs only in the local worker ("hands").
  Never move browser automation into API routes.
- **Fail loudly** — new failure modes must log and alert
  (`sendOpsAlert`), never silently substitute demo/placeholder data.
- **Honest resumes** — the tailor may reorder and rephrase, it may never
  invent employers, skills, metrics, or dates. Do not weaken the
  anti-hallucination contract in `src/services/resume/tailor.js`.

## Adding a job source

1. Create `src/scrapers/<source>.js` exporting `async function scrape()`.
2. Fetch via the shared `http` client, map to the shape in
   `src/scrapers/schema.js`, filter with `titlePassesQualityFilter`,
   and return `ScraperOutputSchema.parse(...)`. Errors must be caught
   and return `[]` so one broken source never sinks a pipeline run.
3. Register it in `src/scrapers/registry.js` — the pipeline, persist
   script, and test runner pick it up automatically.
4. Verify with `npm run test:scrapers`.

Only add sources with a public API, RSS feed, or scraping-tolerant HTML.
Sources whose terms of service prohibit automated access (e.g. LinkedIn)
will not be accepted — company ATS boards (`ats-boards` +
`data/target-companies.json`) already cover most cross-posted roles.

## Commits and pull requests

- Branch from `main` using `feat/...`, `fix/...`, or `chore/...`.
- Atomic commits, message style `type(scope): summary` (see `git log`).
- Run `npm run lint` and `npm run build` before opening a PR.
- Never commit secrets, personal profile/resume JSON, or DB dumps —
  `.gitignore` already covers `data/*.personal.json` and `.env*`.
- Describe *why* in the PR body; link issues where relevant.
