export function DocsFigure({ caption, children }) {
  return (
    <figure className="docs-figure">
      <div className="docs-figure-body">{children}</div>
      {caption ? <figcaption className="docs-figure-cap">{caption}</figcaption> : null}
    </figure>
  );
}
