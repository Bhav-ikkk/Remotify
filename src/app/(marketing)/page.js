import Image from "next/image";
import Link from "next/link";
import styles from "./landing.module.css";

const GITHUB_REPO = "https://github.com/Bhav-ikkk/Remotify";

export const metadata = {
  title: "Remotify — Apply with intent, not volume",
  description:
    "Self-hostable open-source pipeline: scrape remote jobs, score fit, tailor ATS resumes, auto-apply on Greenhouse, Lever, and Ashby.",
};

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand} aria-label="Remotify home">
          <Image
            src="/remotify-mark.png"
            alt=""
            width={36}
            height={36}
            className={styles.brandMark}
            priority
          />
          <span className={styles.brandName}>Remotify</span>
        </Link>
        <a
          className={styles.topLink}
          href={GITHUB_REPO}
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </header>

      <section className={styles.hero} aria-label="Hero">
        <div className={styles.heroMedia} aria-hidden="true">
          <Image
            src="/remotify-hero.jpg"
            alt=""
            fill
            priority
            className={styles.heroImg}
            sizes="100vw"
          />
          <div className={styles.heroShade} />
        </div>

        <div className={styles.heroCopy}>
          <h1 className={styles.heroBrand}>Remotify</h1>
          <p className={styles.headline}>Apply with intent, not volume.</p>
          <p className={styles.support}>
            The self-hostable stack that finds remote roles you fit, builds the
            resume, and applies — on your machine, with your keys.
          </p>
          <div className={styles.ctaRow}>
            <a
              className={styles.ctaPrimary}
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
            >
              Star on GitHub
            </a>
            <Link className={styles.ctaGhost} href="/dashboard">
              Open the app
            </Link>
          </div>
        </div>
      </section>

      <section className={`${styles.problemBand}`}>
        <div className={`${styles.section} ${styles.sectionNarrow}`}>
          <p className={styles.kicker}>The quiet truth</p>
          <h2 className={styles.sectionTitle}>Spray-and-pray is a tax on your time.</h2>
          <p className={styles.sectionBody}>
            Mass apply tools race to a thousand clicks. Recruiters feel the spam.
            You feel the silence. Remotify flips the math: fewer applications,
            higher fit, every one tracked.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.kicker}>How it works</p>
        <h2 className={styles.sectionTitle}>One pipeline. Four honest steps.</h2>
        <p className={styles.sectionBody}>
          Built so apply is the product — not another tracker you fill by hand.
        </p>

        <div className={styles.steps}>
          <article className={styles.step}>
            <div className={styles.stepNum}>01</div>
            <div>
              <h3 className={styles.stepTitle}>Scrape signal</h3>
              <p className={styles.stepBody}>
                Pull remote roles from public boards and company Greenhouse,
                Lever, and Ashby careers APIs — not LinkedIn bots.
              </p>
            </div>
          </article>
          <article className={styles.step}>
            <div className={styles.stepNum}>02</div>
            <div>
              <h3 className={styles.stepTitle}>Score the fit</h3>
              <p className={styles.stepBody}>
                Title prefilters and Gemini match against your real profile so
                weak leads never burn your daily quota.
              </p>
            </div>
          </article>
          <article className={styles.step}>
            <div className={styles.stepNum}>03</div>
            <div>
              <h3 className={styles.stepTitle}>Lock the resume</h3>
              <p className={styles.stepBody}>
                A master ATS resume stays truthful; each strong match gets a
                light, keyword-aware tailor as PDF.
              </p>
            </div>
          </article>
          <article className={styles.step}>
            <div className={styles.stepNum}>04</div>
            <div>
              <h3 className={styles.stepTitle}>Apply locally</h3>
              <p className={styles.stepBody}>
                Vercel queues. Your PC submits with Playwright on supported ATS
                forms. Hard portals land in review — never fake-submitted.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionNarrow}`}>
        <p className={styles.kicker}>Self-hostable</p>
        <h2 className={styles.sectionTitle}>Few moving parts. Full ownership.</h2>
        <p className={styles.sectionBody}>
          No SaaS rent. No account-ban lottery. You keep the keys, the profile,
          and the application history.
        </p>
        <ul className={styles.needsList}>
          <li>
            <span className={styles.dot} aria-hidden="true" />
            <div>
              <strong>Neon Postgres</strong>
              <span>Jobs, scores, applications, and settings in one place.</span>
            </div>
          </li>
          <li>
            <span className={styles.dot} aria-hidden="true" />
            <div>
              <strong>Gemini API key</strong>
              <span>Match scoring and light resume tailor — free tier friendly.</span>
            </div>
          </li>
          <li>
            <span className={styles.dot} aria-hidden="true" />
            <div>
              <strong>Telegram bot</strong>
              <span>Match alerts, resume PDFs, approvals — where you already are.</span>
            </div>
          </li>
          <li>
            <span className={styles.dot} aria-hidden="true" />
            <div>
              <strong>A machine for Playwright</strong>
              <span>Local worker for Greenhouse / Lever / Ashby. Vercel stays the brain.</span>
            </div>
          </li>
        </ul>
      </section>

      <section className={styles.closing}>
        <div className={`${styles.section} ${styles.sectionNarrow}`}>
          <p className={styles.kicker}>Open source</p>
          <h2 className={styles.sectionTitle}>If this feels right, star it.</h2>
          <p className={styles.sectionBody}>
            Remotify is free to run and free to fork. A star helps the next
            engineer find a quieter way to hunt.
          </p>
          <div className={styles.ctaRow} style={{ marginTop: "1.75rem" }}>
            <a
              className={styles.ctaPrimary}
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
            >
              Star Remotify on GitHub
            </a>
            <Link className={styles.ctaGhostDark} href="/dashboard">
              Launch dashboard
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Remotify · MIT · self-hosted apply stack</span>
        <a href={GITHUB_REPO} target="_blank" rel="noreferrer">
          github.com/Bhav-ikkk/Remotify
        </a>
      </footer>
    </div>
  );
}
