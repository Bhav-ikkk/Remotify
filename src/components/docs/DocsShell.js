"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DOCS_NAV } from "./nav";

export function DocsShell({ children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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

      <div className="docs-body">
        <aside
          id="docs-sidebar"
          className={`docs-sidebar ${open ? "is-open" : ""}`}
        >
          <nav aria-label="Documentation">
            <ul>
              {DOCS_NAV.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/docs" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={active ? "is-active" : ""}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main className="docs-main">
          <article className="docs-article">{children}</article>
        </main>
      </div>
    </div>
  );
}
