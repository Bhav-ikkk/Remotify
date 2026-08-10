import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsFigure } from "@/components/docs/DocsFigure";
import { PipelineFlow } from "@/components/docs/PipelineFlow";
import { BrainHands } from "@/components/docs/BrainHands";
import { FunnelBars } from "@/components/docs/FunnelBars";
import { StatusFlow } from "@/components/docs/StatusFlow";
import { ModuleMap } from "@/components/docs/ModuleMap";
import { ThresholdCompare } from "@/components/docs/ThresholdCompare";
import { StackLayers } from "@/components/docs/StackLayers";
import { RoadmapTimeline } from "@/components/docs/RoadmapTimeline";
import { DomainMap } from "@/components/docs/DomainMap";
import { slugifyHeading } from "@/lib/docs-slug";

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
    StackLayers,
    RoadmapTimeline,
    DomainMap,
    h2: (props) => {
      const id = props.id || slugifyHeading(props.children);
      return <h2 {...props} className="docs-h2" id={id} />;
    },
    h3: (props) => {
      const id = props.id || slugifyHeading(props.children);
      return <h3 {...props} className="docs-h3" id={id} />;
    },
    h1: (props) => <h1 {...props} className="docs-h1" />,
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
