# Remotify

**Apply with intent, not volume.**

Self-hostable open-source pipeline — scrape remote jobs, score fit with AI, tailor ATS resumes, and auto-apply on Greenhouse / Lever / Ashby. Built for operators who want interviews, not spray.

Open source · MIT · $0 hosting (Vercel brain + local Playwright hands)

Remotify is a lightweight Next.js automation app that collects remote roles from public boards + company ATS APIs, deduplicates them, quality-prefilters titles, scores fit against your Postgres-backed profile (Gemini), generates a **locked ATS resume PDF** per strong match, queues auto-apply (preferring submitable ATS URLs), and pushes alerts to Telegram. Configuration lives in the database and environment — nothing is hardcoded.

**Positioning vs LoopCV / Simplify:** quality-gated local apply you own, open source, no LinkedIn bots.

---

## Why Remotify?

| Problem | Remotify approach |
| --- | --- |
| Job boards flood you with noise | Title/remote prefilter + AI match scores + min threshold |
| Aggregator links you can't auto-fill | Prefer Greenhouse / Lever / Ashby apply URLs for quota |
| Duplicates across sources | Multi-heuristic dedup + normalized apply-key |
| Generic one-size resumes | Locked master ATS resume + per-job light tailor |
| Secrets scattered in code | Runtime env injection + Prisma-backed settings |
| Overbuilt infra for a personal pipeline | Single Next.js app, Neon Postgres, local worker |

---

## Architectural Pipeline

```text
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│  Scrapers   │───▶│ Normalizers  │───▶│ Deduplicator│───▶│ Prefilter│
│ boards+ATS  │    │ titles/skills│    │ company+URL │    │ title/ATS│
└─────────────┘    └──────────────┘    └─────────────┘    └────┬─────┘
                                                               │
                                                               ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────────────────────┐
│ Local worker│◀───│ Apply queue  │◀───│ AI score → Telegram + PDF   │
│ Playwright  │    │ prefer ATS   │    │ + enqueue (35/day)          │
└─────────────┘    └──────────────┘    └─────────────────────────────┘
```

1. **Scrape** — Remotive, RemoteOK, Himalayas, Arbeitnow, company Greenhouse/Lever/Ashby boards, plus discovery boards.
2. **Normalize** — titles, skills, and remoteness tokens become consistent labels.
3. **Deduplicate** — company+title, apply URL, and similarity checks drop repeats.
4. **Prefilter** — title allow/block + remote preference; auto-ATS ranked first for scoring budget.
5. **Score** — Gemini evaluates each job against your **candidate profile** in Postgres.
6. **Resume** — PDFKit renders your **locked master ATS resume**, lightly tailored per job.
7. **Apply** — enqueue high scores (prefer auto-submit ATS); local Playwright worker submits.
8. **Notify** — matches + apply digest to Telegram; runs write `RunHistory`.

---

## Telegram bot commands

After deploy, register commands + webhook:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/telegram/setup" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"webhookUrl\":\"$NEXT_PUBLIC_APP_URL\"}"
```

| Command | What you get |
| --- | --- |
| `/grab` | Excel of **all** apply-open scraped leads (last 30 days) |
| `/grab 7` | Same, last 7 days |
| `/matches` | Excel of **AI-matched** leads only |
| `/resume` | ATS resume PDF tailored to your best current match |
| `/apply_status` | Auto-apply quota + queue |
| `/apply_digest` | Daily apply KPI digest |
| `/status` | Profile + lead counts |
| `/help` | Command list |

> Tip: DM the bot for slash commands. Prefer a private chat over a channel.

---

## Candidate profile + locked ATS resume

### Profile (matching brain)

Remotify scores jobs against a structured **candidate profile** in Postgres (skills, projects, priorities, experience).

| File | Git? | Purpose |
| --- | --- | --- |
| `data/profile.demo.json` | Yes | Fake sample for open-source clones |
| `data/profile.personal.json` | **No** | Your real profile (gitignored) |

```bash
npm run profile:seed          # personal if present, else demo
npm run profile:seed:demo     # force demo into Postgres
```

`GET /api/profile` · `GET /api/profile?full=1`

### Master resume (PDF source of truth)

Your real ATS PDF is locked as JSON. Job tailoring **reorders / lightly rephrases** only — it does **not** invent employers, metrics, or skills.

| File | Git? | Purpose |
| --- | --- | --- |
| `data/master-resume.demo.json` | Yes | Demo master resume |
| `data/master-resume.personal.json` | **No** | Locked wording from your ATS PDF |
| `data/Bhavik_Joshi_Resume.pdf` | **No** | Original PDF reference copy |

PDF layout (PDFKit / Helvetica, serverless-safe):

1. Header (name, phone, email, Portfolio / GitHub / LinkedIn)  
2. Professional Summary  
3. Technical Skills (categorized)  
4. Professional Experience  
5. Projects  
6. Education  
7. Achievements & Open Source  

```bash
npm run resume:send:locked -- --master   # exact master PDF → Telegram
npm run resume:send:locked               # tailor best DB match → Telegram
npm run resume:send                      # same via DB profile path
npm run verify:grab                      # Excel + PDF locally in .tmp-verify/
npm run verify:grab:send
```

Libraries: **PDFKit** (resume PDF), **ExcelJS** (`/grab` exports), **Gemini** (score + tailor with heuristic fallback).

---

## Tech Stack

- **Runtime:** Next.js (App Router), **plain JavaScript (ESM)** — no TypeScript
- **UI:** `@radix-ui/themes` + Tailwind CSS, `@tabler/icons-react`
- **Data:** Neon PostgreSQL + Prisma ORM
- **Validation / HTTP:** Zod, Axios
- **AI / Notify / Docs:** Gemini · Telegram Bot API · PDFKit · ExcelJS

---

## Prerequisites

- Node.js 20+
- npm 10+
- A [Neon](https://neon.tech) PostgreSQL database
- Gemini API key + Telegram bot credentials for full pipeline

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/Bhav-ikkk/Remotify.git
cd Remotify
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (pooled URL recommended) |
| `GEMINI_API_KEY` | Match scoring + resume tailor |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `TELEGRAM_CHAT_ID` | Target chat / channel ID |
| `TELEGRAM_WEBHOOK_SECRET` | Optional webhook secret header |
| `NEXT_PUBLIC_APP_URL` | Public app URL |
| `CRON_SECRET` | Protect cron + telegram setup routes |
| `ZYTE_API_KEY` / `ZYTE_PROJECT_ID` | Optional Wellfound via Scrapy Cloud |

### 3. Database + profile

```bash
npx prisma db push
npx prisma generate
npm run profile:seed
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Health: `GET /api/test-db`.

### Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run test:scrapers` | Isolation test for each job board scraper |
| `npm run scrape:persist` | Scrape → normalize → quality → dedupe → save (no AI) |
| `npm run score:backfill` | Score unscored quality jobs + enqueue |
| `npm run apply:smoke` | Verify ATS board ingest + auto-submit detect |
| `npm run apply:worker:schedule` | Post-cron local worker helper |
| `npm run apply:digest` | Send Telegram apply KPI digest |
| `npm run resume:send:locked` | Locked/tailored resume → Telegram |
| `npm run telegram:cmd -- /status` | Simulate a bot command locally |

---

## Project Structure

```text
/data
  ├── profile.demo.json           # Sample profile (committed)
  ├── profile.personal.json       # Real profile (gitignored)
  ├── master-resume.demo.json     # Sample ATS master (committed)
  └── master-resume.personal.json # Locked ATS master (gitignored)
/prisma
  └── schema.prisma               # Jobs, settings, scheduler, runs, candidate profile
/src
  ├── app/api/                    # cron, settings, profile, telegram webhook/setup
  ├── services/
  │   ├── pipeline.js             # scrape → score → notify
  │   ├── profile.js              # AI match brief from DB
  │   ├── resume/                 # template, tailor, PDFKit renderer
  │   ├── export/                 # ExcelJS /grab
  │   └── telegram/               # bot commands + client
  ├── scrapers/
  ├── normalizers/
  ├── scripts/
  └── utils/
```

---

## Design Principles

- **Zero secret leakage** — `.gitignore` blocks `.env*`, personal profile/resume files, and build artifacts.
- **Zero dependency inflation** — prefer one solid library over many micro-packages.
- **Plain JavaScript ESM** — no TypeScript sources.
- **Atomic commits** — one logical change per commit.
- **Database-driven config** — operational knobs live in `Setting` / `SchedulerConfig`.
- **Honest resumes** — tailor may emphasize; it may not fabricate.

---

## Contributing

1. Fork and branch from `main` (`feat/...`, `fix/...`, `chore/...`).
2. Match existing folder layout and ESM import style.
3. Keep handlers thin; put business logic in `src/services/`.
4. Validate external payloads with Zod before persistence.
5. Never commit secrets, personal resume/profile JSON, or local DB dumps.
6. Run `npm run build` before opening a PR.

---

## Security

- Secrets never belong in source, docs screenshots, or CI logs.
- Use Neon pooled connection strings with `sslmode=require`.
- Rotate any key that may have been exposed in chat or tickets.
- Production deploys must inject env vars through the host (Vercel, Railway, etc.).

---

## Roadmap (phased)

| Phase | Focus | Status |
| --- | --- | --- |
| **1–7** | Foundation → scrapers → AI score → Telegram → scheduler | Done |
| **8** | Candidate profile DB wired into AI matching | Done |
| **9** | Locked master ATS resume + per-job tailored PDF | Done |
| **10** | Broader job-source coverage (free APIs + ATS boards) + quality prefilter | Done |
| **11** | **Auto-apply** — local Playwright worker, Postgres CRM, Gmail digest, 35/day quota | Done |
| **12** | Application CRM export (Excel) + Telegram approvals + apply KPIs | Done |

---

## Auto-apply (free, 30–35/day)

Vercel is the **brain** (queue + tracking). Your PC is the **hands** (Playwright). No paid hosting.

```bash
# 1) Push schema + seed identity + enqueue scored jobs
npx prisma db push
npm run apply:enqueue

# 2) Start Next.js (API for claim/report)
npm run dev

# 3) On this machine — dry run first (fills forms, does not submit)
npm install -D playwright
npx playwright install chromium
APPLY_DRY_RUN=1 npm run apply:worker

# 4) Live submit (Greenhouse / Lever / Ashby only)
npm run apply:worker
```

| Setting (DB) | Default |
| --- | --- |
| `daily_apply_quota` | 35 |
| `apply_min_score` | 75 |
| `apply_enabled` | true |
| `apply_prefer_auto_ats` | true (Greenhouse/Lever/Ashby fill quota first) |
| `apply_email_to` | your Gmail |

Target company boards: edit [`data/target-companies.json`](data/target-companies.json).

Gmail digest (free): set `GMAIL_USER` + `GMAIL_APP_PASSWORD` (Google App Password).

Telegram: `/apply_status` · `/apply_digest` · `/approvals` · `/approve <id>` · `/skip <id>`

Dashboard: [/applications](/applications) — queued / submitted / needs_review / submit rate.

Schedule the worker after cron: see [`src/workers/apply/README.md`](src/workers/apply/README.md).

Unsupported ATS (Workday, captcha, custom) → `needs_review` (never fake-submit).

RemoteOK / Remotive require attribution if you republish their feeds.

---

## License

MIT — contributions welcome under the same terms.

---

Built for remote-job hunters who automate the grind and keep the stack honest.
