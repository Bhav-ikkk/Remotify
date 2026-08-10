# Candidate profile data

| File | Committed? | Purpose |
| --- | --- | --- |
| `profile.demo.json` | Yes | Fake sample for open-source clones |
| `profile.personal.json` | **No** (gitignored) | Your real profile — skills, projects, priorities |

## Seed

```bash
npm run profile:seed        # personal if present, else demo
npm run profile:seed:demo   # force demo into Postgres
```

Never commit `profile.personal.json`. Keep production DB seeded from your local personal file or a secure one-off seed.
