import { useState } from "react";
import DiagramViewport from "../diagram/DiagramViewport";
import { sectionsOf } from "./metrics.mjs";
import TableContent from "./TableContent";
import { fitText, isCompact, relationColor } from "./presentation.mjs";
import { tr } from "../i18n/renderer";
import {
  matchesRelation,
  nodeRelations,
  relationCaption,
} from "./cardinality.mjs";
import CardinalityLayer from "./CardinalityLayer";
import { resolveRelationSemantics } from '../review/relation-semantics.mjs';

const pathText = (points) =>
  points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
export default function EdaScene({
  result,
  selectedNet,
  selectedRelation = null,
  showCardinality = true,
  onNet,
  onExplain,
  onNode,
  onEdit,
  onField,
  view,
  onView,
  selectedTable = null,
  selectedField = null,
  selectedRelationshipIds = null,
  scale = 1,
  semanticZoom = true,
}) {
  const [hover, setHover] = useState(null);
  const nodeMeta = new Map(result.projection.nodes.map((n) => [n.id, n])),
    edgeMeta = new Map(result.projection.edges.map((e) => [e.id, e]));
  const relationMeta = new Map(
    result.projection.nets.flatMap((n) => n.members.map((r) => [r.id, r])),
  );
  const active = hover ? hover.netId : selectedNet;
  const activeRelation = hover ? hover.relationId : selectedRelation;
  const activeIds = hover ? hover.refs : selectedRelationshipIds;
  const hasActive = activeRelation != null || (activeIds !== null ? activeIds.length > 0 : !!active);
  const activeNet = result.projection.nets.find((n) => n.id === active);
  const activeMembers =
    activeRelation != null
      ? [relationMeta.get(activeRelation)].filter(Boolean)
      : activeIds !== null ? activeIds.map(id => relationMeta.get(id)).filter(Boolean) : activeNet?.members || [];
  const compact = semanticZoom && isCompact(scale);
  const activeTables = new Set(
    activeMembers.flatMap((r) => [r.startTableId, r.endTableId]),
  );
  const endpoint = (tid, fid) =>
    (selectedTable === tid && selectedField === fid) ||
    activeMembers.some((r) =>
      (r.fields || [r]).some(
        (p) =>
          (r.startTableId === tid && p.startFieldId === fid) ||
          (r.endTableId === tid && p.endFieldId === fid),
      ),
    );
  const tableNames = new Map(
    result.projection.tableNames?.map((t) => [t.id, t.name]) ||
      result.projection.nodes
        .filter((n) => n.kind === "table")
        .map((n) => [n.tableId, n.title]),
  );
  const nodeRefs = nodeRelations(result.projection);
  const describe = (refs) =>
    refs
      .map((id) => relationMeta.get(id))
      .filter(Boolean)
      .map((r) =>
        relationCaption(r, (id) => tableNames.get(id) || String(id), tr),
      )
      .join("\n");
  const hoverRelations = (ids, refs = []) =>
    setHover(
      ids
        ? {
            netId: ids.length === 1 ? ids[0] : null,
            relationId: refs.length === 1 ? refs[0] : null,
            refs,
          }
        : null,
    );
  const nodes = result.layout.children || [];
  const domainByTable = new Map(
    result.projection.domains.flatMap((domain) =>
      domain.tableIds.map((id) => [id, domain]),
    ),
  );
  return (
    <DiagramViewport view={view} onView={onView} label="EDA 正交原理图">
      {(result.layout.edges || []).map((edge) => {
        const m = edgeMeta.get(edge.id),
          highlight = matchesRelation(m, active, activeRelation, activeIds),
          dim = hasActive && !highlight,
          uncertain = m.refs.some(
            (id) => ['inferred', 'unknown', 'invalid'].includes(resolveRelationSemantics(relationMeta.get(id)).certainty) || resolveRelationSemantics(relationMeta.get(id)).conditionState === 'invalid',
          ),
          conditionColor = m.kind === "conditional"
            ? domainByTable.get(relationMeta.get(m.refs[0])?.startTableId)?.color
            : null;
        return (
          <g
            key={edge.id}
            data-diagram-interactive
            data-eda-wire={edge.id}
            data-net-ids={JSON.stringify(m.netIds)}
            data-rel-ids={JSON.stringify(m.refs)}
            data-kind={m.kind}
            data-highlight={highlight ? "true" : "false"}
            opacity={dim ? 0.15 : 1}
            role="button"
            tabIndex={0}
            aria-label={describe(m.refs)}
            onPointerEnter={() => hoverRelations(m.netIds, m.refs)}
            onPointerLeave={() => setHover(null)}
            onDoubleClick={(e)=>{e.preventDefault();e.stopPropagation();onExplain?.({refs:m.refs,x:e.clientX,y:e.clientY});}}
            onClick={() =>
              onNet(m.netIds, m.refs.length === 1 ? m.refs[0] : null)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault(); const box=e.currentTarget.getBoundingClientRect();
                onExplain?.({refs:m.refs,x:box.x+box.width/2,y:box.y+box.height/2});
              } else if (e.key === "Enter")
                onNet(m.netIds, m.refs.length === 1 ? m.refs[0] : null);
            }}
          >
            <title>{describe(m.refs)}</title>
            {sectionsOf(edge).map((points, index) => (
              <g key={index}>
                <path
                  d={pathText(points)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  className="eda-wire"
                  d={pathText(points)}
                  fill="none"
                  stroke={
                    m.kind === 'self' ? relationColor(m, relationMeta, domainByTable) : highlight
                      ? "var(--eda-active)"
                      : conditionColor || relationColor(m, relationMeta, domainByTable)
                  }
                  strokeDasharray={uncertain ? "6 4" : undefined}
                  strokeWidth={highlight ? 3 : m.kind === "bus" ? 2.8 : m.kind === "conditional" ? 2 : 1.5}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              </g>
            ))}
            {['conditional', 'self'].includes(m.kind) && (edge.labels || []).map((label) => (
              <g key={label.id} transform={`translate(${label.x},${label.y})`}
                data-eda-condition={label.text} pointerEvents="none">
                <rect width={label.width} height={label.height} rx="5"
                  fill="var(--wiki-card)" stroke={highlight ? "var(--eda-active)" : conditionColor || "var(--wiki-line)"} />
                <text x="10" y="16" fontSize="12" fill={conditionColor || "var(--wiki-ink)"}>
                  {fitText(tr(label.text), label.width - 20, 12)}
                </text>
              </g>
            ))}
          </g>
        );
      })}
      {nodes.map((node) => {
        const m = nodeMeta.get(node.id),
          nodeCompact = compact && !(selectedTable === m.tableId && selectedField != null && m.fields?.some(f => f.id === selectedField)),
          virtual = ["hub", "junction", "label"].includes(m.kind),
          refs = nodeRefs.get(node.id) || [],
          lit =
            m.netId &&
            matchesRelation(
              { netIds: [m.netId], refs },
              active,
              activeRelation,
              activeIds,
            );
        const select = () =>
          virtual
            ? onNet(m.netId, refs.length === 1 ? refs[0] : null)
            : onNode(m);
        return (
          <g
            key={node.id}
            transform={`translate(${node.x},${node.y})`}
            data-diagram-interactive
            data-eda-node={node.id}
            data-node-kind={m.kind}
            data-table-id={m.tableId === undefined ? "" : String(m.tableId)}
            data-net-id={m.netId || ""}
            data-highlight={lit ? "true" : "false"}
            className="eda-node"
            data-selected={selectedTable === m.tableId}
            data-detail={m.kind === "table" && nodeCompact ? "summary" : "fields"}
            opacity={
              m.kind === "table" &&
              hasActive &&
              !activeTables.has(m.tableId)
                ? 0.3
                : 1
            }
            role="button"
            tabIndex={0}
            aria-label={`${m.kind} ${m.title}`}
            onClick={select}
            onDoubleClick={(event) => {
              if (m.kind === "table") {
                event.stopPropagation();
                onEdit(m.tableId);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") select();
            }}
          >
            <title>
              {virtual ? `${m.title}\n${describe(refs)}` : m.comment || m.title}
            </title>
            {m.kind === "junction" ? (
              <>
                <line
                  x1="0"
                  y1="12"
                  x2="24"
                  y2="12"
                  stroke={lit ? "var(--eda-active)" : m.color}
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                  fill={lit ? "var(--eda-active)" : m.color}
                />
              </>
            ) : m.kind === "hub" ? (
              <>
                <path
                  d="M 0 29 H 12 M 68 29 H 80"
                  stroke={lit ? "var(--eda-active)" : m.color}
                  strokeWidth="2"
                />
                <path
                  d="M 40 13 L 68 29 L 40 45 L 12 29 Z"
                  fill="var(--wiki-card)"
                  stroke={lit ? "var(--eda-active)" : m.color}
                  strokeWidth="2"
                />
                <text
                  x="40"
                  y="33"
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--wiki-ink)"
                >
                  {m.fanout}
                </text>
                <text x="40" y="10" textAnchor="middle" className="eda-small">
                  Hub · {m.title}
                </text>
              </>
            ) : m.kind === "label" ? (
              <>
                <path
                  d={`M 0 0 H ${m.width - 12} L ${m.width} 26 L ${m.width - 12} 52 H 0 Z`}
                  fill="var(--wiki-card)"
                  stroke={lit ? "var(--eda-active)" : m.color}
                  strokeWidth={lit ? 3 : 1.5}
                />
                <text x="10" y="21" className="eda-label-code">
                  {m.title} · Net Label
                </text>
                <text x="10" y="40" className="eda-small">
                  {m.subtitle.slice(0, 25)}
                </text>
              </>
            ) : (
              <>
                <rect
                  width={node.width}
                  height={node.height}
                  rx="8"
                  vectorEffect="non-scaling-stroke"
                  fill="var(--wiki-card)"
                  stroke={
                    selectedTable === m.tableId || activeTables.has(m.tableId)
                      ? "var(--eda-active)"
                      : "var(--wiki-line)"
                  }
                  strokeWidth={
                    selectedTable === m.tableId || activeTables.has(m.tableId)
                      ? 2
                      : 1
                  }
                />
                <rect width={node.width} height="4" rx="2" fill={m.color} />
                {m.kind === "domain" ? (
                  <>
                    <text x="12" y="26" className="eda-node-title">
                      {fitText(
                        m.domainId === "__unassigned__" ? tr(m.title) : m.title,
                        node.width - 24,
                        14,
                      )}
                    </text>
                    <text x="12" y="55" className="eda-small">
                      {m.tableIds.length} 张表 · {m.internal.length} 条内部关系
                    </text>
                    <text x="12" y="90" className="eda-small">
                      点击进入领域 →
                    </text>
                  </>
                ) : (
                  <TableContent
                    node={node}
                    meta={m}
                    compact={nodeCompact}
                    scale={scale}
                    endpoint={endpoint}
                    onField={onField}
                  />
                )}
              </>
            )}
            {(node.ports || []).map((p) => (
              <circle
                key={p.id}
                data-eda-port={p.id}
                data-port-side={p.layoutOptions["elk.port.side"]}
                data-field-ids={JSON.stringify(p.fieldIds || [])}
                cx={p.x}
                cy={p.y}
                r="2.5"
                fill={m.color || "#64748b"}
                pointerEvents="none"
              />
            ))}
          </g>
        );
      })}
      {showCardinality && (
        <CardinalityLayer
          result={result}
          activeNet={active}
          activeRelation={activeRelation}
          activeIds={activeIds}
          onSelect={onNet}
          onHover={hoverRelations}
          describe={describe}
        />
      )}
    </DiagramViewport>
  );
}
