const NODES = [
  { id: "queued", label: "queued", hint: "Waiting for worker claim" },
  { id: "preparing", label: "preparing", hint: "Claimed; resume + browser" },
  { id: "submitting", label: "submitting", hint: "Adapter filling form" },
  { id: "submitted", label: "submitted", hint: "Confirmed / approved" },
  { id: "review", label: "needs_review", hint: "Human must finish" },
  { id: "failed", label: "failed", hint: "Hard error" },
  { id: "skipped", label: "skipped", hint: "Operator skipped" },
];

const EDGES = [
  { from: "queued", to: "preparing", via: "POST /api/apply/claim" },
  { from: "preparing", to: "submitting", via: "adapter start" },
  { from: "preparing", to: "submitted", via: "dry-run / success report" },
  { from: "preparing", to: "review", via: "unknown ATS / captcha" },
  { from: "preparing", to: "failed", via: "adapter or API error" },
  { from: "submitting", to: "submitted", via: "report submitted" },
  { from: "submitting", to: "review", via: "partial fill" },
  { from: "submitting", to: "failed", via: "submit error" },
  { from: "review", to: "submitted", via: "/approve <id>" },
  { from: "review", to: "skipped", via: "/skip <id>" },
];

export function StatusFlow() {
  return (
    <div className="docs-status" aria-label="Application status transitions">
      <ol className="docs-status-rail">
        {NODES.map((n) => (
          <li key={n.id} className={`docs-status-node node-${n.id}`}>
            <strong>{n.label}</strong>
            <span>{n.hint}</span>
          </li>
        ))}
      </ol>
      <ul className="docs-status-edges">
        {EDGES.map((e) => (
          <li key={`${e.from}-${e.to}-${e.via}`}>
            <code>{e.from}</code>
            <span className="docs-status-arrow">→</span>
            <code>{e.to}</code>
            <span className="docs-status-via">{e.via}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
