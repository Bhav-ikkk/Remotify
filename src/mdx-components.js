import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsFigure } from "@/components/docs/DocsFigure";
import { PipelineFlow } from "@/components/docs/PipelineFlow";
import { BrainHands } from "@/components/docs/BrainHands";
import { FunnelBars } from "@/components/docs/FunnelBars";
import { StatusFlow } from "@/components/docs/StatusFlow";
import { ModuleMap } from "@/components/docs/ModuleMap";
import { ThresholdCompare } from "@/components/docs/ThresholdCompare";

/** @type {import('mdx/types').MDXComponents} */
export function useMDXComponents(components) {
  return {
    ...components,
    Callout: DocsCallout,
    Figure: DocsFigure,
    PipelineFlow,
    BrainHands,
    FunnelBars,
    StatusFlow,
    ModuleMap,
    ThresholdCompare,
    h1: (props) => <h1 className="docs-h1" {...props} />,
    h2: (props) => <h2 className="docs-h2" {...props} />,
    h3: (props) => <h3 className="docs-h3" {...props} />,
    p: (props) => <p className="docs-p" {...props} />,
    ul: (props) => <ul className="docs-ul" {...props} />,
    ol: (props) => <ol className="docs-ol" {...props} />,
    li: (props) => <li className="docs-li" {...props} />,
    a: (props) => <a className="docs-a" {...props} />,
    code: (props) => {
      const isBlock = typeof props.className === "string";
      return isBlock ? (
        <code {...props} />
      ) : (
        <code className="docs-inline-code" {...props} />
      );
    },
    pre: (props) => <pre className="docs-pre" {...props} />,
    table: (props) => (
      <div className="docs-table-wrap">
        <table className="docs-table" {...props} />
      </div>
    ),
    th: (props) => <th className="docs-th" {...props} />,
    td: (props) => <td className="docs-td" {...props} />,
    blockquote: (props) => <blockquote className="docs-quote" {...props} />,
    hr: () => <hr className="docs-hr" />,
  };
}
