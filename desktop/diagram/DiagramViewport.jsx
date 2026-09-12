import { useEffect, useId, useRef } from "react";
import { clientPointToWorld, zoomAtPoint } from "../eda/camera.mjs";

// Shared viewport interaction only; ER and process semantics have separate renderers.
export default function DiagramViewport({ view, onView, children, label }) {
  const svg = useRef(null),
    drag = useRef(null),
    update = useRef(onView);
  update.current = onView;
  const gridId = "diagram-grid-" + useId().replaceAll(":", "");
  useEffect(() => {
    const element = svg.current;
    const wheel = (event) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const factor = Math.exp(Math.max(-0.5, Math.min(0.5, delta * 0.0015)));
      update.current((previous) =>
        zoomAtPoint(
          previous,
          factor,
          clientPointToWorld(previous, rect, event.clientX, event.clientY),
        ),
      );
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  return (
    <svg
      ref={svg}
      className="eda-scene"
      data-eda-scene
      viewBox={view.join(" ")}
      aria-label={label}
      onPointerDown={(event) => {
        if (
          event.button !== 0 ||
          event.target.closest("[data-diagram-interactive]")
        )
          return;
        drag.current = { x: event.clientX, y: event.clientY, view: [...view] };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const rect = event.currentTarget.getBoundingClientRect(),
          previous = drag.current;
        const scale = Math.max(
          previous.view[2] / rect.width,
          previous.view[3] / rect.height,
        );
        onView([
          previous.view[0] - (event.clientX - previous.x) * scale,
          previous.view[1] - (event.clientY - previous.y) * scale,
          previous.view[2],
          previous.view[3],
        ]);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <defs>
        <pattern
          id={gridId}
          width="30"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r=".8" fill="var(--wiki-grid)" />
        </pattern>
      </defs>
      <rect
        x={view[0]}
        y={view[1]}
        width={view[2]}
        height={view[3]}
        fill={"url(#" + gridId + ")"}
      />
      {children}
    </svg>
  );
}
