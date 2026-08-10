const PHASES = [
  {
    phase: "Now",
    tone: "now",
    items: [
      "Stable scrape → score → Telegram → queue → local apply",
      "Greenhouse / Lever / Ashby auto-submit",
      "Live MDX docs + operator dashboard",
    ],
  },
  {
    phase: "Next",
    tone: "next",
    items: [
      "Workday adapter (detected today, not auto-submitted)",
      "Stronger claim locks + retry taxonomy",
      "Remove personal stubs (slug / default email)",
      "Richer RunHistory dashboards",
    ],
  },
  {
    phase: "Later",
    tone: "later",
    items: [
      "Optional TypeScript migration of hot paths",
      "Multi-profile / multi-tenant operator mode",
      "Browserbase / cloud hands for always-on apply",
      "Slack/Discord notify providers via same facade",
    ],
  },
];

export function RoadmapTimeline() {
  return (
    <div className="docs-roadmap" aria-label="Product roadmap">
      {PHASES.map((block) => (
        <section key={block.phase} className={`docs-roadmap-card tone-${block.tone}`}>
          <h4 className="docs-roadmap-phase">{block.phase}</h4>
          <ul>
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
