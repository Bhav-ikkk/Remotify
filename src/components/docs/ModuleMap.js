const MODULES = [
  {
    layer: "Ingress",
    items: [
      ["scrapers/registry.js", "Canonical scraper list"],
      ["scrapers/ats-boards.js", "Public GH/Lever/Ashby boards"],
      ["scrapers/schema.js", "Zod JobSchema"],
    ],
  },
  {
    layer: "Transform",
    items: [
      ["normalizers/index.js", "Title/skill/location buckets"],
      ["utils/deduplicate.js", "URL + company/title + Jaccard"],
      ["utils/job-quality.js", "Allow/block + ATS rank"],
    ],
  },
  {
    layer: "Intelligence",
    items: [
      ["services/profile.js", "buildAiMatchProfile()"],
      ["services/ai/gemini.js", "gemini-2.5-flash"],
      ["utils/ai-batch.js", "Sequential evaluateJob"],
    ],
  },
  {
    layer: "Orchestration",
    items: [
      ["services/pipeline.js", "runPipeline()"],
      ["services/scheduler.js", "UTC 2 & 12 locks"],
      ["services/notification.js", "Telegram + PDF"],
    ],
  },
  {
    layer: "Apply",
    items: [
      ["services/apply/queue.js", "Enqueue / claim / report"],
      ["services/apply/ats.js", "detectAtsType"],
      ["workers/apply/run.js", "Playwright loop"],
    ],
  },
  {
    layer: "Surfaces",
    items: [
      ["services/telegram/bot-commands.js", "Slash commands"],
      ["app/(app)/*", "Operator UI"],
      ["app/api/*", "HTTP contracts"],
    ],
  },
];

export function ModuleMap() {
  return (
    <div className="docs-modules">
      {MODULES.map((block) => (
        <section key={block.layer} className="docs-modules-block">
          <h4 className="docs-modules-layer">{block.layer}</h4>
          <ul>
            {block.items.map(([path, note]) => (
              <li key={path}>
                <code>{path}</code>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
