import { DocsShell } from "@/components/docs/DocsShell";
import "./docs.css";

export const metadata = {
  title: "Documentation · Remotify",
  description:
    "Live system documentation for Remotify — architecture, data flow, code construction, BDD, apply pipeline, and operations.",
};

export default function DocsLayout({ children }) {
  return <DocsShell>{children}</DocsShell>;
}
