# Remotify

**Open-source remote job intelligence pipeline** — scrape, normalize, score with AI, and notify. Built for operators who want signal, not noise.

Remotify is a lightweight Next.js automation app that collects remote roles from public boards, deduplicates them, scores fit with Gemini, and pushes the strongest matches to Telegram. Configuration lives in the database and environment — nothing is hardcoded.

---

## Why Remotify?

| Problem | Remotify approach |
| --- | --- |
| Job boards flood you with noise | AI match scores + minimum threshold filters |
| Duplicates across sources | Multi-heuristic dedup before scoring |
| Secrets scattered in code | Runtime env injection + Prisma-backed settings |
| Overbuilt infra for a personal pipeline | Single Next.js app, Neon Postgres, zero microservices |

---

## Architectural Pipeline

```text
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│  Scrapers   │───▶│ Normalizers  │───▶│ Deduplicator│───▶│ AI Score │
│ (per-site)  │    │ titles/skills│    │ company+URL │    │ (Gemini) │
└─────────────┘    └──────────────┘    └─────────────┘    └────┬─────┘
                                                               │
                                                               ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────────────────────┐
│  Dashboard  │◀───│  Neon +      │◀───│ Telegram top-N notifications│
│  + Settings │    │  Prisma ORM  │    │ + RunHistory telemetry      │
└─────────────┘    └──────────────┘    └─────────────────────────────┘
```

1. **Scrape** — site modules return a uniform Zod-validated job shape.
2. **Normalize** — titles, skills, and remoteness tokens become consistent labels.
3. **Deduplicate** — company+title, apply URL, and similarity checks drop repeats.
4. **Score** — Gemini evaluates each job against a target profile (`aiScore`, matched/missing skills, reason).
5. **Notify** — top matches go to Telegram; every run writes `RunHistory` metrics.
6. **Observe** — dashboard KPIs and settings panels stay in sync with Postgres.

---

## Tech Stack

- **Runtime:** Next.js (App Router), **plain JavaScript (ESM)** — no TypeScript
- **UI:** `@radix-ui/themes` + Tailwind CSS, `@tabler/icons-react`
- **Data:** Neon PostgreSQL + Prisma ORM
- **Validation / HTTP:** Zod, Axios
- **AI / Notify:** Gemini API key + Telegram Bot API (runtime env only)

---

## Prerequisites

- Node.js 20+
- npm 10+
- A [Neon](https://neon.tech) PostgreSQL database
- (Later phases) Gemini API key and Telegram bot credentials

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/Bhav-ikkk/Remotify.git
cd Remotify
npm install
```

### 2. Environment blueprint

Copy the example file and fill values **locally only** — never commit `.env`:

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (pooled URL recommended) |
| `GEMINI_API_KEY` | Google Gemini API key for match scoring |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `TELEGRAM_CHAT_ID` | Target chat / channel ID for alerts |
| `NEXT_PUBLIC_APP_URL` | Public app URL (default `http://localhost:3000`) |

All database, AI, and notification secrets are injected **strictly at runtime** via environment variables.

### 3. Database

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connectivity can be verified via `GET /api/test-db` during Phase 1.

---

## Project Structure

```text
/prisma
  └── schema.prisma          # Job, Setting, SchedulerConfig, RunHistory
/src
  ├── app/
  │   ├── api/               # Route handlers (pipeline, settings, health)
  │   ├── dashboard/         # Metrics UI (later phases)
  │   ├── settings/          # Control panels (later phases)
  │   └── layout.js
  ├── components/            # Shared UI
  ├── services/              # database, ai, notification, scheduler
  ├── scrapers/              # One module per job board
  ├── normalizers/           # Title / skill / location rules
  └── utils/                 # Dedup helpers
```

---

## Design Principles

- **Zero secret leakage** — `.gitignore` blocks `.env*`, `.next`, Prisma binaries, and caches. Only `.env.example` (empty values) is tracked.
- **Zero dependency inflation** — prefer one solid library over many micro-packages. Do not add Redis, Kafka, auth frameworks, or ORMs beyond Prisma unless a phase explicitly requires it.
- **Plain JavaScript ESM** — no TypeScript, no `.ts` / `.tsx` sources.
- **Atomic commits** — one logical change per commit with a clear, professional message.
- **Database-driven config** — operational knobs live in `Setting` / `SchedulerConfig`, not hardcoded constants.

---

## Contributing

1. Fork and branch from `main` (`feat/...`, `fix/...`, `chore/...`).
2. Match existing folder layout and ESM import style (`import` / `export`).
3. Keep handlers thin; put business logic in `src/services/`.
4. Validate external payloads with Zod before persistence.
5. Never commit secrets, screenshots of `.env`, or local DB dumps.
6. Run `npm run build` before opening a PR.
7. Prefer small PRs aligned to a single phase or module.

### Code style

- Prefer clarity over cleverness.
- Catch scraper errors locally; one failure must not abort the whole pipeline.
- Avoid new dependencies unless they replace more code than they add.

---

## Security

- Secrets never belong in source, docs screenshots, or CI logs.
- Use Neon pooled connection strings with `sslmode=require`.
- Rotate any key that may have been exposed in chat or tickets.
- Production deploys must inject env vars through the host (Vercel, Railway, etc.).

---

## Roadmap (phased)

| Phase | Focus |
| --- | --- |
| **1** | Open-source foundation, Prisma schema, Neon migrations, DB health route |
| **2** | Layout shells + settings dashboard |
| **3** | Per-site scrapers + Zod validation |
| **4** | Normalizers + deduplication |
| **5** | Gemini scoring strategy wrapper |
| **6** | Telegram notifications |
| **7** | Scheduler + chunked pipeline + cleanup |

---

## License

MIT — contributions welcome under the same terms.

---

Built for remote-job hunters who automate the grind and keep the stack honest.
