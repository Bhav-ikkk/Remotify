"use client";

import { useEffect, useState } from "react";

/**
 * Builds an "On this page" TOC from h2 headings inside the article.
 */
export function DocsToc() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const article = document.querySelector(".docs-article");
    if (!article) return undefined;

    const collect = () => {
      const headings = [...article.querySelectorAll("h2[id]")];
      setItems(
        headings.map((el) => ({
          id: el.id,
          label: el.textContent?.trim() || el.id,
        }))
      );
    };

    collect();
    const observer = new MutationObserver(collect);
    observer.observe(article, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (items.length < 2) return null;

  return (
    <nav className="docs-toc" aria-label="On this page">
      <p className="docs-toc-title">On this page</p>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
