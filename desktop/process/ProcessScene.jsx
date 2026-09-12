import DiagramViewport from "../diagram/DiagramViewport";
import { ProcessNode, ProcessEdge } from "./ProcessGlyphs";

export default function ProcessScene({
  result,
  view,
  onView,
  selected,
  onSelect,
}) {
  const nodes = new Map(result.projection.nodes.map((node) => [node.id, node]));
  const edges = new Map(result.projection.edges.map((edge) => [edge.id, edge]));
  return (
    <DiagramViewport view={view} onView={onView} label="业务流程图">
      {(result.layout.edges || []).map((edge) => (
        <ProcessEdge
          key={edge.id}
          edge={edge}
          meta={edges.get(edge.id)}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
      {(result.layout.children || []).map((node) => {
        const meta = nodes.get(node.id);
        return (
          <g
            key={node.id}
            transform={`translate(${node.x},${node.y})`}
            data-diagram-interactive
            data-node-kind={meta.kind}
            role="button"
            tabIndex={0}
            aria-label={meta.title}
            onClick={() => onSelect(meta.stepId)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(meta.stepId);
              }
            }}
          >
            <title>{meta.comment || meta.title}</title>
            <ProcessNode node={node} meta={meta} selected={selected} />
          </g>
        );
      })}
    </DiagramViewport>
  );
}
