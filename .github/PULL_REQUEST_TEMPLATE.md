## Summary

<!-- What does this change and why? -->

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Atomic commits with `type(scope): summary` messages
- [ ] No secrets or personal data (profile/resume JSON, `.env`) included
- [ ] New external payloads validated with Zod
- [ ] New failure modes fail loudly (log + alert), never silently
- [ ] For new job sources: `npm run test:scrapers` returns schema-valid jobs
      and the source's terms allow automated access
