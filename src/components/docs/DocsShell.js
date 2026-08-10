"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DOCS_NAV_GROUPS } from "./nav";
import { DocsPager } from "./DocsPager";
import { DocsToc } from "./DocsToc";

function isActive(pathname, href) {
  if (href === "/docs") return pathname === "/docs";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DocsShell({ children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="docs-shell" data-docs="true">
      <header className="docs-top">
        <Link href="/" className="docs-brand">
          <Image
            src="/remotify-mark.png"
            alt=""
            width={28}
            height={28}
            className="docs-brand-mark"
          />
          <span>Remotify Docs</span>
        </Link>
        <button
          type="button"
          className="docs-menu-btn"
          aria-expanded={open}
          aria-controls="docs-sidebar"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
        <nav className="docs-top-links" aria-label="Docs shortcuts">
          <Link href="/docs/tech-stack">Stack</Link>
          <Link href="/docs/operations">Ops</Link>
          <Link href="/dashboard">App</Link>
          <a
            href="https://github.com/Bhav-ikkk/Remotify"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
      </header>

      {open ? (
        <button
          type="button"
          className="docs-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="docs-body">
        <aside
          id="docs-sidebar"
          className={`docs-sidebar ${open ? "is-open" : ""}`}
        >
          <nav aria-label="Documentation">
            {DOCS_NAV_GROUPS.map((group) => (
              <div key={group.title} className="docs-nav-group">
                <p className="docs-nav-group-title">{group.title}</p>
                <ul>
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={active ? "is-active" : ""}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="docs-main">
          <div className="docs-main-grid">
            <article className="docs-article">
              {children}
              <DocsPager />
            </article>
            <DocsToc />
          </div>
        </main>
      </div>
    </div>
  );
}
