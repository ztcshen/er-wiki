import { useMemo } from "react";
import {
  cardinalityBadges,
  bundleBadges,
  matchesRelation,
} from "./cardinality.mjs";
import { tr } from "../i18n/renderer";
import { SELF_REFERENCE_COLOR } from './presentation.mjs';

export default function CardinalityLayer({
  result,
  activeNet,
  activeRelation,
  activeIds = null,
  onSelect,
  onHover,
  describe,
}) {
  const badges = useMemo(
    () => cardinalityBadges(result, activeRelation),
    [result, activeRelation],
  );
  const bundles = useMemo(() => bundleBadges(result), [result]);
  const selfRefs = new Set(result.projection.nets.filter(net => net.selfReference).flatMap(net => net.members.map(relation => relation.id)));
  return (
    <g data-cardinality-layer>
      {badges.map((badge) => {
        const active = matchesRelation(badge, activeNet, activeRelation, activeIds),
          text = tr(badge.value);
        const color = badge.refs.every(id => selfRefs.has(id)) ? SELF_REFERENCE_COLOR : active ? "var(--eda-active)" : "var(--wiki-muted)";
        const width = badge.width;
        const select = () =>
          onSelect(
            badge.netIds,
            badge.refs.length === 1 ? badge.refs[0] : null,
          );
        return (
          <g
            key={badge.id}
            transform={`translate(${badge.x},${badge.y})`}
            data-eda-cardinality={badge.value}
            data-diagram-interactive
            data-cardinality-table={String(badge.tableId)}
            data-port-side={badge.side}
            data-rel-ids={JSON.stringify(badge.refs)}
            data-highlight={active ? "true" : "false"}
            role="button"
            tabIndex={0}
            aria-label={describe(badge.refs)}
            opacity={(activeNet || activeRelation != null || activeIds?.length) && !active ? 0.2 : 1}
            onClick={select}
            onKeyDown={(event) => {
              if (event.key === "Enter") select();
            }}
            onPointerEnter={() => onHover(badge.netIds, badge.refs)}
            onPointerLeave={() => onHover(null)}
          >
            <title>{describe(badge.refs)}</title>
            <rect
              x={-width / 2}
              y={-badge.height / 2}
              width={width}
              height={badge.height}
              rx="4"
              fill="var(--wiki-card)"
              stroke={color}
              strokeOpacity={active ? 1 : 0.5}
              vectorEffect="non-scaling-stroke"
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="system-ui,sans-serif"
              fontSize={badge.value === "混合" ? 9 : 12}
              fontWeight="650"
              fill={color}
            >
              {text}
            </text>
          </g>
        );
      })}
      {bundles.map((badge) => {
        const active = matchesRelation(badge, activeNet, activeRelation, activeIds);
        return (
          <g
            key={badge.id}
            transform={`translate(${badge.x},${badge.y})`}
            data-bundle-count={badge.count}
            pointerEvents="none"
            opacity={(activeNet || activeRelation != null || activeIds?.length) && !active ? 0.2 : 1}
          >
            <rect
              x="-32"
              y="-8"
              width="64"
              height="16"
              rx="3"
              fill="var(--wiki-card)"
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="9"
              fill="var(--wiki-muted)"
            >
              {badge.count} 条关系
            </text>
          </g>
        );
      })}
    </g>
  );
}
