"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_FLAT } from "./nav";

export function DocsPager() {
  const pathname = usePathname();
  const index = DOCS_FLAT.findIndex((item) => item.href === pathname);
  if (index < 0) return null;

  const prev = DOCS_FLAT[index - 1];
  const next = DOCS_FLAT[index + 1];

  return (
    <nav className="docs-pager" aria-label="Page navigation">
      {prev ? (
        <Link href={prev.href} className="docs-pager-link docs-pager-prev">
          <span className="docs-pager-dir">Previous</span>
          <span className="docs-pager-label">{prev.label}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="docs-pager-link docs-pager-next">
          <span className="docs-pager-dir">Next</span>
          <span className="docs-pager-label">{next.label}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
