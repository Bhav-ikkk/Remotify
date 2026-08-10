# Candidate profile data

| File | Committed? | Purpose |
| --- | --- | --- |
| `profile.demo.json` | Yes | Fake sample profile for open-source clones |
| `profile.personal.json` | **No** (gitignored) | Your real profile — skills, projects, priorities |
| `master-resume.demo.json` | Yes | Demo ATS master resume |
| `master-resume.personal.json` | **No** (gitignored) | Locked wording from your real ATS PDF |
| `Bhavik_Joshi_Resume.pdf` | **No** (gitignored) | Original resume reference copy |

## Seed / resume

```bash
npm run profile:seed
npm run resume:send          # tailor best match + Telegram PDF
```

Resume PDFs are generated from `master-resume.*.json` (not invented copy). Job tailoring only reorders/rephrases within those facts.
