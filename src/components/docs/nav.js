/** Grouped documentation navigation. Order defines prev/next. */
export const DOCS_NAV_GROUPS = [
  {
    title: "Start here",
    items: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/architecture", label: "Architecture" },
      { href: "/docs/tech-stack", label: "Tech stack & choices" },
      { href: "/docs/roadmap", label: "Roadmap & future" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/docs/data-flow", label: "Data flow" },
      { href: "/docs/domain-model", label: "Domain model" },
      { href: "/docs/pipeline", label: "Pipeline" },
      { href: "/docs/normalization", label: "Normalization & quality" },
      { href: "/docs/code-construction", label: "Code construction" },
    ],
  },
  {
    title: "Apply path",
    items: [
      { href: "/docs/apply-resume", label: "Apply & resume" },
      { href: "/docs/telegram-ui", label: "Telegram & UI" },
    ],
  },
  {
    title: "Operate",
    items: [
      { href: "/docs/operations", label: "Operations" },
      { href: "/docs/marketing", label: "Launch & growth" },
    ],
  },
];

export const DOCS_FLAT = DOCS_NAV_GROUPS.flatMap((group) => group.items);

/** @deprecated use DOCS_FLAT — kept for any external imports */
export const DOCS_NAV = DOCS_FLAT;
