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

Env:

| Variable | Default | Meaning |
| --- | --- | --- |
| `APPLY_API_BASE` | `NEXT_PUBLIC_APP_URL` or localhost:3000 | API origin |
| `APPLY_DRY_RUN` | unset | `1` = fill only |
| `APPLY_DELAY_MS` | 150000 | Pause between apps |
| `APPLY_WORKER_MAX` | 35 | Max apps this process |
| `APPLY_HEADED` | unset | `1` = show browser |
| `APPLY_WORKER_SECRET` / `CRON_SECRET` | optional | Bearer auth |

Windows Task Scheduler can run `npm run apply:worker` daily after the morning cron.
