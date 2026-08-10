"use client";

import { useEffect, useState } from "react";

const STAGES = [
  { id: "scrape", label: "Scrape", file: "scrapers/registry.js" },
  { id: "norm", label: "Normalize", file: "normalizers/index.js" },
  { id: "dedupe", label: "Dedupe", file: "utils/deduplicate.js" },
  { id: "quality", label: "Quality", file: "utils/job-quality.js" },
  { id: "ai", label: "AI score", file: "utils/ai-batch.js" },
  { id: "persist", label: "Persist", file: "pipeline.js upsert" },
  { id: "notify", label: "Notify", file: "notification.js" },
  { id: "enqueue", label: "Enqueue", file: "apply/queue.js" },
];

export function PipelineFlow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;
    const id = setInterval(() => setActive((i) => (i + 1) % STAGES.length), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="docs-flow" aria-label="Pipeline stages animation">
      <div className="docs-flow-track" aria-hidden="true">
        <div
          className="docs-flow-fill"
          style={{ width: `${((active + 1) / STAGES.length) * 100}%` }}
        />
      </div>
      <ol className="docs-flow-list">
        {STAGES.map((stage, i) => (
          <li
            key={stage.id}
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
              <span className="docs-flow-label">{stage.label}</span>
              <span className="docs-flow-file">{stage.file}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="docs-flow-hint">
        Active stage: <strong>{STAGES[active].label}</strong> —{" "}
        <code>{STAGES[active].file}</code>
      </p>
    </div>
  );
}
