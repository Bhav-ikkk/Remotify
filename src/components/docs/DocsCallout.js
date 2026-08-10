export function DocsCallout({ title = "Note", tone = "info", children }) {
  return (
    <aside className={`docs-callout docs-callout-${tone}`} role="note">
      <strong className="docs-callout-title">{title}</strong>
      <div className="docs-callout-body">{children}</div>
    </aside>
  );
}
