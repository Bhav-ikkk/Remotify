# Local auto-apply worker ($0)

Vercel queues jobs. This worker fills forms on your PC with Playwright.

## Setup

```bash
npm install -D playwright
npx playwright install chromium
```

Optional Gmail digest (free app password):

```
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx
```

## Run

```bash
# Terminal A
npm run dev

# Terminal B — dry run (no Submit click)
npm run apply:worker:dry

# Live (Greenhouse / Lever / Ashby auto-submit)
npm run apply:worker
```

Smoke (public ATS boards + detect auto-submit URLs):

```bash
npm run apply:smoke
```

## Windows Task Scheduler (daily after cron)

1. Ensure `npm run dev` (or production `npm start`) is running, or point `APPLY_API_BASE` at your Vercel URL.
2. Create a task after morning cron (~08:30 IST / post UTC 02:00 Hobby cron):

```bash
# Dry first
npm run apply:worker:schedule -- --dry-run

# Live
npm run apply:worker:schedule
```

Optional wait before claiming:

```bash
APPLY_SCHEDULE_WAIT_MS=300000 npm run apply:worker:schedule
```

Program/script for Task Scheduler: `node`  
Arguments: `src/scripts/apply-worker-schedule.js`  
Start in: your Remotify repo root.

Env:

| Variable | Default | Meaning |
| --- | --- | --- |
| `APPLY_API_BASE` | `NEXT_PUBLIC_APP_URL` or localhost:3000 | API origin |
| `APPLY_DRY_RUN` | unset | `1` = fill only |
| `APPLY_DELAY_MS` | 150000 | Pause between apps |
| `APPLY_WORKER_MAX` | 35 | Max apps this process |
| `APPLY_HEADED` | unset | `1` = show browser |
| `APPLY_WORKER_SECRET` / `CRON_SECRET` | optional | Bearer auth |
| `APPLY_SCHEDULE_WAIT_MS` | 0 | Delay before schedule helper starts |

Queue prefers Greenhouse / Lever / Ashby (`apply_prefer_auto_ats=true`) so unknown portals do not steal daily quota.
