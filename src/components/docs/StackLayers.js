const LAYERS = [
  {
    name: "Edge & UI",
    items: ["Next.js 15 App Router", "React 19", "MDX docs", "Radix Themes", "Tailwind 4"],
  },
  {
    name: "Orchestration",
    items: ["pipeline.js", "scheduler.js", "Vercel Cron", "Settings JSON bag"],
  },
  {
    name: "Intelligence",
    items: ["Gemini 2.5 Flash", "AIService strategy", "CandidateProfile", "Resume tailor"],
  },
  {
    name: "Ingress",
    items: ["axios + cheerio", "Zod JobSchema", "ATS board APIs", "Zyte (Wellfound)"],
  },
  {
    name: "Persistence",
    items: ["Prisma 6", "Neon PostgreSQL", "RunHistory", "Application CRM"],
  },
  {
    name: "Hands (local)",
    items: ["Playwright", "GH / Lever / Ashby adapters", "pdfkit PDFs", "Nodemailer digests"],
  },
];

export function StackLayers() {
  return (
    <div className="docs-stack" aria-label="Technology layers">
      {LAYERS.map((layer, i) => (
        <div key={layer.name} className="docs-stack-row">
          <div className="docs-stack-index">{String(i + 1).padStart(2, "0")}</div>
          <div className="docs-stack-body">
            <h4 className="docs-stack-name">{layer.name}</h4>
            <ul className="docs-stack-items">
              {layer.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
