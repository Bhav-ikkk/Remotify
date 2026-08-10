/**
 * Stable heading id from MDX children.
 * @param {unknown} children
 */
export function slugifyHeading(children) {
  const text = flattenText(children)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return text || "section";
}

function flattenText(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (typeof node === "object" && "props" in node) {
    return flattenText(node.props?.children);
  }
  return "";
}
