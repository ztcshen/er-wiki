import { useMemo } from "react";
import {
  cardinalityBadges,
  bundleBadges,
  matchesRelation,
} from "./cardinality.mjs";
import { tr } from "../i18n/renderer";

export default function CardinalityLayer({
  result,
  activeNet,
  activeRelation,
  onSelect,
  onHover,
  describe,
}) {
  const badges = useMemo(
    () => cardinalityBadges(result, activeRelation),
    [result, activeRelation],
  );
  const bundles = useMemo(() => bundleBadges(result), [result]);
  return (
    <g data-cardinality-layer>
      {badges.map((badge) => {
        const active = matchesRelation(badge, activeNet, activeRelation),
          text = tr(badge.value);
        const color = active ? "var(--eda-active)" : "var(--wiki-muted)";
        const width = badge.value === "混合" ? 46 : 22;
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
            data-cardinality-table={String(badge.tableId)}
            data-rel-ids={JSON.stringify(badge.refs)}
            data-highlight={active ? "true" : "false"}
            role="button"
            tabIndex={0}
            aria-label={describe(badge.refs)}
            opacity={(activeNet || activeRelation != null) && !active ? 0.2 : 1}
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
              y="-9"
              width={width}
              height="18"
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
        const active = matchesRelation(badge, activeNet, activeRelation);
        return (
          <g
            key={badge.id}
            transform={`translate(${badge.x},${badge.y})`}
            data-bundle-count={badge.count}
            pointerEvents="none"
            opacity={(activeNet || activeRelation != null) && !active ? 0.2 : 1}
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
