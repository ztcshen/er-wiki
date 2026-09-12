import { useRef } from "react";
import {
  centerViewAt,
  clientPointToWorld,
  visibleWorldView,
} from "./camera.mjs";

export default function EdaMinimap({ result, view, viewport, onView, onFit }) {
  const dragging = useRef(false);
  const bounds = [
    0,
    0,
    Math.max(100, result.layout.width || 800),
    Math.max(100, result.layout.height || 500),
  ];
  const metadata = new Map(
    result.projection.nodes.map((node) => [node.id, node]),
  );
  const [x, y, width, height] = visibleWorldView(view, viewport);
  const recenter = (event) => {
    const point = clientPointToWorld(
      bounds,
      event.currentTarget.getBoundingClientRect(),
      event.clientX,
      event.clientY,
    );
    if (point)
      onView((previous) =>
        centerViewAt(previous, {
          x: Math.max(0, Math.min(bounds[2], point.x)),
          y: Math.max(0, Math.min(bounds[3], point.y)),
        }),
      );
  };
  return (
    <div className="eda-minimap">
      <span aria-hidden="true">导航概览</span>
      <svg
        viewBox={bounds.join(" ")}
        aria-label="导航小地图"
        role="group"
        tabIndex={0}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          recenter(event);
        }}
        onPointerMove={(event) => {
          if (dragging.current) recenter(event);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onKeyDown={(event) => {
          const moves = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
          };
          if (event.key === "Home") {
            event.preventDefault();
            onFit();
          } else if (moves[event.key]) {
            event.preventDefault();
            const [dx, dy] = moves[event.key];
            onView((previous) =>
              centerViewAt(previous, {
                x: previous[0] + previous[2] * (0.5 + dx * 0.2),
                y: previous[1] + previous[3] * (0.5 + dy * 0.2),
              }),
            );
          }
        }}
      >
        <title>点击或拖动定位，方向键平移，Home 显示全图。</title>
        {(result.layout.children || [])
          .filter((node) =>
            ["table", "domain"].includes(metadata.get(node.id)?.kind),
          )
          .map((node) => (
            <rect
              key={node.id}
              data-minimap-node={node.id}
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              rx="8"
              fill={metadata.get(node.id).color}
              opacity=".55"
              pointerEvents="none"
            />
          ))}
        <rect
          data-minimap-viewport
          x={x}
          y={y}
          width={width}
          height={height}
          className="eda-minimap-viewport"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}
