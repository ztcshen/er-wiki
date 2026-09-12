import { sectionsOf } from "../eda/metrics.mjs";
import { useId } from "react";
export const accessLabel = (access) =>
  ({ read: "读取", create: "创建", update: "更新", delete: "删除" })[access] ||
  access;
export function ProcessNode({ node, meta, selected }) {
  const active = meta.stepId === selected,
    fill = active ? "var(--eda-field-active)" : "var(--wiki-card)";
  return (
    <g data-process-step={meta.stepId} data-selected={active}>
      {meta.kind === "decision" ? (
        <path
          d={`M ${node.width / 2} 0 L ${node.width} ${node.height / 2} L ${node.width / 2} ${node.height} L 0 ${node.height / 2} Z`}
          fill={fill}
          stroke={active ? "var(--eda-active)" : "#865bb4"}
          strokeWidth="2"
        />
      ) : (
        <rect
          width={node.width}
          height={node.height}
          rx={meta.kind === "event" ? 30 : 10}
          fill={fill}
          stroke={active ? "var(--eda-active)" : "var(--wiki-line)"}
          strokeWidth={active ? 2.5 : 1.5}
        />
      )}
      <text
        x={node.width / 2}
        y={meta.kind === "event" ? 35 : 39}
        textAnchor="middle"
        fill="var(--wiki-ink)"
        fontSize="14"
        fontWeight="650"
      >
        {meta.title.length > Math.floor((node.width - 24) / 13)
          ? meta.title.slice(0, Math.floor((node.width - 24) / 13) - 1) + "…"
          : meta.title}
      </text>
      {meta.kind !== "event" && (
        <>
          <text
            x={node.width / 2}
            y="61"
            textAnchor="middle"
            fill="var(--wiki-muted)"
            fontSize="10"
          >
            {meta.kind === "decision" ? "条件分支" : "业务动作"}
          </text>
          <text
            x={node.width / 2}
            y="81"
            textAnchor="middle"
            fill="var(--wiki-muted)"
            fontSize="10"
          >
            {meta.step.bindings.length} 个数据映射
          </text>
        </>
      )}
    </g>
  );
}
export function ProcessEdge({ edge, meta, selected, onSelect }) {
  const active = meta.from === selected || meta.to === selected;
  const color = meta.flowKind === "return" ? "#865bb4" : "#0f766e";
  const marker = "process-arrow-" + useId().replaceAll(":", "");
  return (
    <g
      data-process-edge={meta.id}
      data-diagram-interactive
      data-edge-kind={meta.kind}
      data-flow-kind={meta.flowKind}
      data-selected={active}
      opacity={!selected || active ? 1 : 0.65}
      role="button"
      tabIndex={0}
      aria-label={meta.label || "流程连接"}
      onClick={() => onSelect(meta.to)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(meta.to);
        }
      }}
    >
      <defs>
        <marker
          id={marker}
          markerWidth="5"
          markerHeight="5"
          refX="4.5"
          refY="2.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 5 2.5 L 0 5 Z" fill={color} />
        </marker>
      </defs>
      {sectionsOf(edge).map((points, index) => (
        <g key={index}>
          <path
            d={points
              .map((point, i) => `${i ? "L" : "M"} ${point.x} ${point.y}`)
              .join(" ")}
            fill="none"
            stroke="transparent"
            strokeWidth="16"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={points
              .map((point, i) => `${i ? "L" : "M"} ${point.x} ${point.y}`)
              .join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={active ? 1.8 : 1.3}
            markerEnd={`url(#${marker})`}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        </g>
      ))}
      {(edge.labels || []).map((label) => (
        <g key={label.id} transform={`translate(${label.x},${label.y})`}>
          <rect
            width={label.width}
            height={label.height}
            rx="4"
            fill="var(--wiki-card)"
            stroke={color}
            strokeOpacity=".25"
          />
          <text
            x={label.width / 2}
            y="15"
            textAnchor="middle"
            fill={color}
            fontSize="11"
          >
            {label.text.slice(0, 24)}
          </text>
        </g>
      ))}
    </g>
  );
}
