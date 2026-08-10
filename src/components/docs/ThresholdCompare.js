export function ThresholdCompare() {
  return (
    <div className="docs-thresh" aria-label="Notify versus apply thresholds">
      <div className="docs-thresh-card">
        <p className="docs-thresh-kicker">Notify gate</p>
        <p className="docs-thresh-value">≥ 85</p>
        <p className="docs-thresh-key">
          Setting: <code>min_match_score</code>
        </p>
        <p className="docs-thresh-desc">
          Top 5 un-notified jobs → Telegram message + tailored PDF. Marks{" "}
          <code>isNotified</code>.
        </p>
      </div>
      <div className="docs-thresh-card docs-thresh-card-accent">
        <p className="docs-thresh-kicker">Apply gate</p>
        <p className="docs-thresh-value">≥ 75</p>
        <p className="docs-thresh-key">
          Setting: <code>apply_min_score</code>
        </p>
        <p className="docs-thresh-desc">
          Enters <code>applications</code> queue (prefer Greenhouse / Lever /
          Ashby). Daily quota default 35.
        </p>
      </div>
    </div>
  );
}
