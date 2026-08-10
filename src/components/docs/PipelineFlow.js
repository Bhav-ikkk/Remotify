"use client";

import { useEffect, useState } from "react";

const STAGES = [
  {
    id: "scrape",
    label: "Scrape",
    file: "scrapers/registry.js",
    blurb: "Promise.allSettled over every registered source. Soft-fail empty arrays.",
  },
  {
    id: "norm",
    label: "Normalize",
    file: "normalizers/index.js",
    blurb: "Canonical titles, skills, remote tokens so dedupe and AI see one shape.",
  },
  {
    id: "dedupe",
    label: "Dedupe",
    file: "utils/deduplicate.js",
    blurb: "URL key, company+title, then Jaccard similarity against recent DB jobs.",
  },
  {
    id: "quality",
    label: "Quality",
    file: "utils/job-quality.js",
    blurb: "Title allow/block + remote checks before spending Gemini tokens.",
  },
  {
    id: "ai",
    label: "AI score",
    file: "utils/ai-batch.js",
    blurb: "Sequential Gemini evaluateJob against CandidateProfile (cron-capped).",
  },
  {
    id: "persist",
    label: "Persist",
    file: "pipeline.js upsert",
    blurb: "Upsert Job by applyUrl with score, matched/missing skills, reason.",
  },
  {
    id: "notify",
    label: "Notify",
    file: "notification.js",
    blurb: "Top matches ≥ min_match_score (default 85) → Telegram + optional PDF.",
  },
  {
    id: "enqueue",
    label: "Enqueue",
    file: "apply/queue.js",
    blurb: "Quota-aware Application rows; prefer Greenhouse/Lever/Ashby.",
  },
];

export function PipelineFlow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;
    const id = setInterval(() => setActive((i) => (i + 1) % STAGES.length), 1800);
    return () => clearInterval(id);
  }, []);

  const stage = STAGES[active];

  return (
    <div className="docs-flow" aria-label="Pipeline stages animation">
      <div className="docs-flow-track" aria-hidden="true">
        <div
          className="docs-flow-fill"
          style={{ width: `${((active + 1) / STAGES.length) * 100}%` }}
        />
      </div>
      <ol className="docs-flow-list">
        {STAGES.map((s, i) => (
          <li
            key={s.id}
            className={`docs-flow-item ${i === active ? "is-active" : ""} ${
              i < active ? "is-done" : ""
            }`}
          >
            <button
              type="button"
              className="docs-flow-btn"
              onClick={() => setActive(i)}
            >
              <span className="docs-flow-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="docs-flow-label">{s.label}</span>
              <span className="docs-flow-file">{s.file}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="docs-flow-hint">
        <strong>{stage.label}</strong> — {stage.blurb} Owner: <code>{stage.file}</code>
      </p>
    </div>
  );
}
