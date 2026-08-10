"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./landing.module.css";

const GITHUB_REPO = "https://github.com/Bhav-ikkk/Remotify";

const PIPELINE = [
  {
    id: "scrape",
    label: "Scrape",
    detail: "Remote boards + Greenhouse / Lever / Ashby",
  },
  {
    id: "score",
    label: "Score",
    detail: "Title gate → Gemini fit against your profile",
  },
  {
    id: "resume",
    label: "Resume",
    detail: "Locked ATS master, lightly tailored PDF",
  },
  {
    id: "apply",
    label: "Apply",
    detail: "Local Playwright on supported ATS forms",
  },
];

const FEED = [
  { company: "Stripe", role: "Full Stack Engineer", score: 86, ats: "Greenhouse" },
  { company: "Linear", role: "Software Engineer", score: 81, ats: "Ashby" },
  { company: "Vercel", role: "Frontend Engineer", score: 78, ats: "Greenhouse" },
];

function useReveal() {
  const ref = useRef(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, on };
}

function Reveal({ children, className = "", delay = 0 }) {
  const { ref, on } = useReveal();
  return (
    <div
      ref={ref}
      className={`${styles.reveal} ${on ? styles.revealOn : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [feedIndex, setFeedIndex] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;

    const stepTimer = setInterval(() => {
      setActiveStep((s) => (s + 1) % PIPELINE.length);
    }, 2200);
    const feedTimer = setInterval(() => {
      setFeedIndex((i) => (i + 1) % FEED.length);
    }, 2800);
    return () => {
      clearInterval(stepTimer);
      clearInterval(feedTimer);
    };
  }, []);

  const live = FEED[feedIndex];

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
        <nav className={styles.topNav} aria-label="Landing">
          <a className={styles.topLink} href="#pipeline">
            Pipeline
          </a>
          <a className={styles.topLink} href="#self-host">
            Self-host
          </a>
          <Link className={styles.topLink} href="/docs">
            Docs
          </Link>
          <a
            className={styles.topLink}
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
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

      {/* Contrast: spray vs intent */}
      <section className={styles.contrast} aria-labelledby="contrast-title">
        <div className={styles.contrastInner}>
          <Reveal>
            <p className={styles.kickerLight}>Why Remotify exists</p>
            <h2 id="contrast-title" className={styles.contrastTitle}>
              Mass apply feels productive. It isn&apos;t.
            </h2>
          </Reveal>
          <div className={styles.contrastGrid}>
            <Reveal delay={80} className={styles.contrastCol}>
              <p className={styles.contrastLabel}>Spray tools</p>
              <ul className={styles.contrastList}>
                <li>1,000 applications, near-zero replies</li>
                <li>LinkedIn bots that risk your account</li>
                <li>Your data locked inside someone else&apos;s SaaS</li>
              </ul>
            </Reveal>
            <Reveal delay={160} className={`${styles.contrastCol} ${styles.contrastColAccent}`}>
              <p className={styles.contrastLabel}>Remotify</p>
              <ul className={styles.contrastList}>
                <li>Only roles above your fit threshold</li>
                <li>Direct ATS apply — Greenhouse, Lever, Ashby</li>
                <li>Open source. Your keys. Your quota. Your CRM.</li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Live automation theater */}
      <section
        id="pipeline"
        className={styles.theater}
        aria-labelledby="pipeline-title"
      >
        <div className={styles.theaterHead}>
          <Reveal>
            <p className={styles.kicker}>Automation you can see</p>
            <h2 id="pipeline-title" className={styles.sectionTitleWide}>
              Watch a lead move through the stack.
            </h2>
            <p className={styles.sectionBodyWide}>
              Not a dashboard dump — a quiet loop: scrape → score → resume →
              apply. Built so <em>apply</em> is the product.
            </p>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <div className={styles.rail} role="list" aria-label="Pipeline stages">
            <div
              className={styles.railPulse}
              style={{
                width: `${((activeStep + 1) / PIPELINE.length) * 100}%`,
              }}
              aria-hidden="true"
            />
            {PIPELINE.map((step, i) => (
              <div
                key={step.id}
                role="listitem"
                className={`${styles.railNode} ${
                  i === activeStep ? styles.railNodeActive : ""
                } ${i < activeStep ? styles.railNodeDone : ""}`}
              >
                <span className={styles.railDot} aria-hidden="true" />
                <span className={styles.railLabel}>{step.label}</span>
                <span className={styles.railDetail}>{step.detail}</span>
              </div>
            ))}
          </div>
        </Reveal>

        <div className={styles.liveGrid}>
          <Reveal delay={120} className={styles.livePanel}>
            <div className={styles.liveTop}>
              <span className={styles.liveBadge}>Live match</span>
              <span className={styles.liveAts}>{live.ats}</span>
            </div>
            <p className={styles.liveRole} key={`${live.company}-${live.role}`}>
              {live.role}
            </p>
            <p className={styles.liveCompany}>{live.company}</p>
            <div className={styles.scoreTrack} aria-hidden="true">
              <div
                className={styles.scoreFill}
                style={{ width: `${live.score}%` }}
              />
            </div>
            <p className={styles.scoreMeta}>
              Fit score <strong>{live.score}</strong> · queued for apply
            </p>
          </Reveal>

          <Reveal delay={200} className={styles.livePanel}>
            <p className={styles.toastKicker}>Telegram</p>
            <div className={styles.toast} key={feedIndex}>
              <p className={styles.toastTitle}>New match · {live.score}%</p>
              <p className={styles.toastBody}>
                {live.role} @ {live.company}
              </p>
              <p className={styles.toastFoot}>ATS resume PDF attached</p>
            </div>
            <div className={styles.toast} style={{ animationDelay: "120ms" }}>
              <p className={styles.toastTitle}>Apply queue</p>
              <p className={styles.toastBody}>
                +1 {live.ats} · quota 12/35 · run local worker
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Steps as horizontal story on desktop */}
      <section className={styles.story} aria-labelledby="story-title">
        <Reveal>
          <p className={styles.kicker}>Four honest steps</p>
          <h2 id="story-title" className={styles.sectionTitleWide}>
            From board to submitted — without LinkedIn bots.
          </h2>
        </Reveal>
        <ol className={styles.storyGrid}>
          {PIPELINE.map((step, i) => (
            <Reveal key={step.id} delay={i * 90} className={styles.storyItem}>
              <li>
                <span className={styles.storyNum}>0{i + 1}</span>
                <h3 className={styles.storyTitle}>{step.label}</h3>
                <p className={styles.storyBody}>{step.detail}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Self-host */}
      <section
        id="self-host"
        className={styles.host}
        aria-labelledby="host-title"
      >
        <div className={styles.hostInner}>
          <Reveal>
            <p className={styles.kickerLight}>Self-hostable</p>
            <h2 id="host-title" className={styles.hostTitle}>
              Four things. Then it runs.
            </h2>
            <p className={styles.hostLead}>
              Vercel is the brain. Your PC is the hands. No SaaS rent. No
              account-ban lottery.
            </p>
          </Reveal>
          <ul className={styles.hostGrid}>
            {[
              ["Neon Postgres", "Jobs, scores, applications, settings"],
              ["Gemini API key", "Fit scoring + light resume tailor"],
              ["Telegram bot", "Alerts, PDFs, approvals"],
              ["Playwright machine", "Local Greenhouse / Lever / Ashby submit"],
            ].map(([title, body], i) => (
              <Reveal key={title} delay={i * 70} className={styles.hostItem}>
                <li>
                  <span className={styles.hostIndex}>0{i + 1}</span>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Open source close */}
      <section className={styles.closing} aria-labelledby="close-title">
        <Reveal>
          <p className={styles.kicker}>Open source · MIT</p>
          <h2 id="close-title" className={styles.sectionTitleWide}>
            Built for engineers who want interviews — not spray metrics.
          </h2>
          <p className={styles.sectionBodyWide}>
            Star it if the thesis clicks. Fork it if you want to own the
            pipeline. Remotify is free to run and honest about what it
            auto-submits.
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
        </Reveal>
      </section>

      <footer className={styles.footer}>
        <span>Remotify · Apply with intent, not volume</span>
        <a href={GITHUB_REPO} target="_blank" rel="noreferrer">
          github.com/Bhav-ikkk/Remotify
        </a>
      </footer>
    </div>
  );
}
