const BARS = [
  { label: "Scraped raw", value: 100, tone: "mute" },
  { label: "After normalize", value: 92, tone: "mute" },
  { label: "After dedupe", value: 70, tone: "mute" },
  { label: "Quality prefilter", value: 45, tone: "mid" },
  { label: "Cron scored (cap)", value: 12, tone: "mid" },
  { label: "Notify ≥85", value: 4, tone: "hot" },
  { label: "Enqueue ≥75 auto-ATS", value: 8, tone: "hot" },
];

/** Illustrative funnel proportions — relative, not live metrics. */
export function FunnelBars() {
  return (
    <div className="docs-funnel" role="img" aria-label="Illustrative lead funnel">
      {BARS.map((bar) => (
        <div key={bar.label} className="docs-funnel-row">
          <div className="docs-funnel-meta">
            <span>{bar.label}</span>
            <span className="docs-funnel-val">{bar.value}</span>
          </div>
          <div className="docs-funnel-track">
            <div
              className={`docs-funnel-fill tone-${bar.tone}`}
              style={{ width: `${bar.value}%` }}
            />
          </div>
        </div>
      ))}
      <p className="docs-funnel-note">
        Relative illustration of how volume shrinks toward apply. Cron caps AI at
        12 jobs; notify and apply use different score gates.
      </p>
    </div>
  );
}
