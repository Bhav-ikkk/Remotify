# Remotify marketing & star-growth plan

**Product line:** Apply with intent, not volume.  
**Repo:** https://github.com/Bhav-ikkk/Remotify  
**Promise:** Self-hostable open-source scrape → score → resume → apply (Greenhouse / Lever / Ashby). No LinkedIn bots. $0 hosting shape (Vercel + local Playwright).

This plan is built for **Product Hunt**, **GitHub stars**, and long-term developer adoption — not vanity traffic.

---

## 1. Positioning (memorize this)

| Audience | One-liner |
| --- | --- |
| Engineers job hunting | Open-source auto-apply that only hits roles you fit |
| Self-hosters | Your keys, your CRM, local Playwright hands |
| PH / makers | Quality-gated apply stack vs spray SaaS |
| HN | Show HN: self-hosted remote job pipeline with ATS autofill |

**Do say:** fit threshold, ATS-direct, self-host, Telegram alerts, MIT.  
**Don’t say:** “apply to 1000 jobs overnight,” “LinkedIn Easy Apply bot,” guaranteed interviews.

**Competitive frame (honest):**

- vs **LoopCV / AI Applyd** — you own the stack; no monthly apply tax  
- vs **Simplify** — full pipeline, not only autofill extension  
- vs **LazyApply-style bots** — we refuse LinkedIn account risk  

---

## 2. Pre-launch checklist (2–3 weeks)

### Product polish
- [ ] Landing live and mobile-perfect (`/`)
- [ ] README reads like a product page (GIF of pipeline + 60s setup)
- [ ] `npm run apply:smoke` + dry worker documented
- [ ] Demo video (60–90s): scrape → Telegram match → resume PDF → queue
- [ ] Clear “What it does / doesn’t” section (no Workday auto-submit yet)

### Assets for Product Hunt
- [ ] Logo mark (`public/remotify-mark.png`)
- [ ] Gallery: landing hero, applications CRM, Telegram screenshot, pipeline diagram
- [ ] Tagline (≤60 chars): **Apply with intent, not volume**
- [ ] Short description (≤260 chars): Self-hostable open-source job pipeline that scores remote roles, builds ATS resumes, and auto-applies on Greenhouse, Lever, and Ashby.
- [ ] Maker first comment drafted (see §5)

### Social proof seed
- [ ] Soft-share with 10–20 trusted engineers for feedback (not “please upvote”)
- [ ] Indie Hackers build log (journey post, not launch day dump)
- [ ] Pin GitHub Topics: `job-search`, `remote-work`, `playwright`, `nextjs`, `open-source`, `ats`, `telegram-bot`

---

## 3. Where to talk (ranked for GitHub stars)

Stars follow **developer density + “I can clone this tonight”**. Ranked for Remotify:

### Tier A — highest star ROI (do these first)

| Channel | Why it works for Remotify | How to show up |
| --- | --- | --- |
| **Hacker News — Show HN** | Best channel for OSS + self-host + technical honesty | Tue–Thu morning US. Title: `Show HN: Remotify – self-hosted remote job apply pipeline (scrape → score → ATS)`. Body: problem, architecture (Vercel brain / local hands), what ATS you support, GitHub link. Stay in comments 4–6h. |
| **Reddit — r/selfhosted** | Self-host audience stars and forks | Focus on ownership, Neon, local Playwright, no account ban story. Follow sub rules; value-first. |
| **Reddit — r/opensource** | Discovery + stars | Same framing; link README + license. |
| **GitHub Trending** | Compounding machine | Needs a 48h star spike from HN/Reddit/PH. README + topics + activity must be clean that week. |

### Tier B — Product discovery & badges

| Channel | Why | How |
| --- | --- | --- |
| **Product Hunt** | Badge, press, non-dev makers; secondary for stars but huge legitimacy | Tue–Thu **12:01am PT**. Hunter optional. Maker replies all day. Gallery + demo video mandatory. |
| **Indie Hackers** | Founders empathize with job-hunt grind | Build log → launch update with real numbers (apps queued, not vanity). |
| **Dev.to / Hashnode** | Evergreen SEO | Post: “I built a self-hosted apply pipeline that refuses LinkedIn bots” with architecture diagram. |

### Tier C — niche amplification

| Channel | Angle |
| --- | --- |
| **r/cscareerquestions** / **r/ExperiencedDevs** | Careful: help-first. “Here’s an open-source alternative to spray tools” — no spam. |
| **r/SideProject** | Friendly launch share |
| **r/webdev** / **r/nextjs** | Technical build story |
| **X/Twitter** | Thread with demo GIF + GitHub; tag builder communities, not spam bots |
| **LinkedIn** | Personal builder story (ironic but works for job-seekers) |
| **Telegram / Discord OSS communities** | Soft share in job-hunt / self-host rooms |

### Tier D — directories & roundups (slow burn)

- Awesome lists: remote jobs, self-hosted, Playwright tools  
- AlternativeTo / similar “LoopCV alternative (open source)” pages  
- Newsletter pitches: TLDR, Changelog, Node Weekly, Selenium/Playwright roundups  

**Skip or deprioritize:** generic Facebook groups, paid star services, LinkedIn Easy-Apply bot forums (wrong brand).

---

## 4. 48-hour ignition window (star velocity)

Goal: concentrate traffic so Remotify can hit **GitHub Trending**.

**Suggested order (same 48 hours):**

1. **T−2h** — Publish polished README + demo GIF  
2. **T0** — Product Hunt goes live (12:01am PT)  
3. **T0+1h** — Show HN (if PH is live; or swap: HN first if you want pure star velocity — for OSS, **HN primary / PH same day** is fine)  
4. **T0+3h** — r/selfhosted + r/opensource (stagger 1–2h)  
5. **All day** — reply to every technical comment; never argue with cynics about “auto-apply ethics” — restate: fit-gated + supported ATS only  
6. **T+24h** — Dev.to long-form + X thread recap with metrics  

**Important:** Don’t spray 10 subreddits in 10 minutes. Authenticity > coverage.

---

## 5. Copy bank

### Product Hunt
- **Name:** Remotify  
- **Tagline:** Apply with intent, not volume  
- **Topics:** Open Source, Developer Tools, Artificial Intelligence, Remote Work, Job Boards  

**Maker comment (draft):**

> Hey PH 👋 I’m Bhavik. Remotify is an open-source, self-hostable pipeline I built while job hunting: scrape remote roles → score fit with Gemini against my real profile → tailor an ATS resume → queue auto-apply on Greenhouse/Lever/Ashby via a local Playwright worker.  
>  
> Vercel is the brain (queue/CRM). Your PC is the hands ($0 browser automation). No LinkedIn bots — by design.  
>  
> Would love feedback on: (1) company board lists, (2) Workday later, (3) review-first UX.  
> GitHub: https://github.com/Bhav-ikkk/Remotify

### Show HN title options
1. `Show HN: Remotify – self-hosted remote job apply (scrape, score, ATS submit)`  
2. `Show HN: Remotify – quality-gated auto-apply you run yourself`  
3. `Show HN: An open-source alternative to spray job-apply SaaS`

### Tweet / short post
> Open-sourced my job hunt stack: Remotify scrapes remote roles, scores fit, builds ATS resumes, and applies on Greenhouse/Lever/Ashby from your machine.  
> Apply with intent, not volume.  
> https://github.com/Bhav-ikkk/Remotify

---

## 6. Product Hunt day ops

| Time (PT) | Action |
| --- | --- |
| 12:01am | Launch live; pin maker comment |
| First 2h | Reply to every comment; ask hunters for specific feedback |
| Morning US | Share demo video; update gallery if needed |
| Afternoon | Post soft IH / X updates linking PH (not “upvote me”) |
| EOD | Thank supporters; collect objections into GitHub issues |

**Success metrics (honest):**

- Primary: GitHub stars + unique clones / `git clone` interest  
- Secondary: PH rank / upvotes  
- Quality: issues filed, forks, Telegram users self-hosting  

---

## 7. Post-launch (weeks 2–8)

1. Ship one visible improvement per week (Workable detect, more company boards, README GIF).  
2. Turn PH/HN objections into public roadmap issues.  
3. Write “How I auto-apply without LinkedIn bots” — SEO long-form.  
4. Collect 3 user quotes for landing (with permission).  
5. Re-launch PH only with a **material** new feature (not spam).  

---

## 8. Weekly star habit (sustain)

- Answer issues within 48h  
- Keep `good first issue` labeled  
- Share one architecture nugget / week on X or Dev.to  
- Touch r/selfhosted only when you have a real update  

---

## 9. Ethics & brand guardrails

Remotify wins trust by being the **anti-spam** apply tool:

- Prefer fit ≥ threshold  
- Prefer auto-submit ATS; unknown portals → review  
- Never sell “guaranteed jobs”  
- Never automate LinkedIn session hijacking  

That story converts better on HN and PH than any spray claim.

---

## 10. Immediate next actions (this week)

1. Record 60–90s demo GIF/MP4 for README + PH  
2. Schedule PH for a Tue/Wed/Thu  
3. Draft Show HN body in a notepad; don’t post until README is sharp  
4. Soft-validate in Indie Hackers with a build log  
5. Add GitHub Topics + social preview image  

When those five are done, run the 48-hour ignition window.
