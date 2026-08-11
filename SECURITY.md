# Security Policy

Remotify handles real personal data (resume, contact details, application
history) and holds credentials for Gmail, Telegram, and Gemini. Treat every
deployment as production.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guided-security-advisories)
on this repository ("Report a vulnerability" under the Security tab).
You should receive a response within 72 hours.

## Deployment hardening checklist

- Set `APPLY_WORKER_SECRET` (and `CRON_SECRET`) everywhere — the
  `/api/apply/*` endpoints fail closed with 401 when no secret is
  configured, so an unset secret disables the worker rather than
  exposing the queue.
- Set `TELEGRAM_WEBHOOK_SECRET` so only Telegram can hit the webhook.
- Use Neon pooled connection strings with `sslmode=require`.
- Inject secrets through the host (Vercel env vars); never commit `.env`.
- `APPLY_EMAIL_TO` must be explicitly configured — there is no fallback
  recipient, by design.
- Rotate any key that may have been exposed in chat, logs, or tickets.

## Scope notes

- Personal data files (`data/*.personal.json`, generated PDFs) are
  gitignored; the source of truth is the database.
- Resume PDFs are stored as `ResumeArtifact` rows for provenance —
  protect database access accordingly.
