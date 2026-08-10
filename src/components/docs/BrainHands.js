export function BrainHands() {
  return (
    <div className="docs-split" aria-label="Brain versus hands architecture">
      <div className="docs-split-panel">
        <p className="docs-split-kicker">Brain</p>
        <h4 className="docs-split-title">Vercel + Neon + Gemini</h4>
        <ul>
          <li>Scrapers &amp; pipeline</li>
          <li>AI scoring &amp; resume PDF</li>
          <li>Telegram webhook</li>
          <li>Apply queue / claim / report APIs</li>
          <li>Dashboard &amp; settings</li>
        </ul>
        <p className="docs-split-foot">
          Entry: <code>src/services/pipeline.js</code>
        </p>
      </div>
      <div className="docs-split-arrow" aria-hidden="true">
        →
      </div>
      <div className="docs-split-panel docs-split-panel-accent">
        <p className="docs-split-kicker">Hands</p>
        <h4 className="docs-split-title">Your PC + Playwright</h4>
        <ul>
          <li>Claim queued applications</li>
          <li>Attach tailored resume PDF</li>
          <li>Fill Greenhouse / Lever / Ashby</li>
          <li>Report submitted or needs_review</li>
          <li>Rate-limited delays between apps</li>
        </ul>
        <p className="docs-split-foot">
          Entry: <code>src/workers/apply/run.js</code>
        </p>
      </div>
    </div>
  );
}
