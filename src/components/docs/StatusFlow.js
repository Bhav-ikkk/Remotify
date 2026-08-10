const NODES = [
  { id: "queued", label: "queued" },
  { id: "preparing", label: "preparing" },
  { id: "submitted", label: "submitted" },
  { id: "review", label: "needs_review" },
  { id: "failed", label: "failed" },
  { id: "skipped", label: "skipped" },
];

const EDGES = [
  ["queued", "preparing"],
  ["preparing", "submitted"],
  ["preparing", "review"],
  ["preparing", "failed"],
  ["review", "submitted"],
  ["review", "skipped"],
];

export function StatusFlow() {
  return (
    <div className="docs-status" aria-label="Application status transitions">
      <div className="docs-status-nodes">
        {NODES.map((n) => (
          <div key={n.id} className={`docs-status-node node-${n.id}`}>
            {n.label}
          </div>
        ))}
      </div>
      <ul className="docs-status-edges">
        {EDGES.map(([from, to]) => (
          <li key={`${from}-${to}`}>
            <code>{from}</code> → <code>{to}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
