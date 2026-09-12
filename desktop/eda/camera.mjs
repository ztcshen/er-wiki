import { validView } from "./reading-state.mjs";

// SVG uses xMidYMid meet: account for the unused margins on either axis.
export function viewScale(view, viewport) {
  return viewport?.width > 0 && viewport?.height > 0
    ? Math.min(viewport.width / view[2], viewport.height / view[3])
    : 0;
}

export function clientPointToWorld(view, rect, clientX, clientY) {
  const scale = viewScale(view, rect);
  if (!scale) return null;
  return {
    x: view[0] + view[2] / 2 + (clientX - rect.left - rect.width / 2) / scale,
    y: view[1] + view[3] / 2 + (clientY - rect.top - rect.height / 2) / scale,
  };
}

export function centerViewAt(view, point) {
  const next = [point.x - view[2] / 2, point.y - view[3] / 2, view[2], view[3]];
  return validView(next) ? next : view;
}

export function zoomAtPoint(
  view,
  factor,
  point = { x: view[0] + view[2] / 2, y: view[1] + view[3] / 2 },
) {
  if (!Number.isFinite(factor) || factor <= 0 || !point) return view;
  const bounded = Math.max(
    100 / view[2],
    Math.min(factor, 1e7 / view[2], 1e7 / view[3]),
  );
  const next = [
    point.x + (view[0] - point.x) * bounded,
    point.y + (view[1] - point.y) * bounded,
    view[2] * bounded,
    view[3] * bounded,
  ];
  return validView(next) ? next : view;
}

export function actualSizeView(view, viewport) {
  if (!(viewport?.width >= 100 && viewport?.height > 0)) return view;
  return centerViewAt([0, 0, viewport.width, viewport.height], {
    x: view[0] + view[2] / 2,
    y: view[1] + view[3] / 2,
  });
}

export function visibleWorldView(view, viewport) {
  const scale = viewScale(view, viewport);
  return scale
    ? centerViewAt([0, 0, viewport.width / scale, viewport.height / scale], {
        x: view[0] + view[2] / 2,
        y: view[1] + view[3] / 2,
      })
    : view;
}

export function focusNodeView(node, viewport, padding = 56) {
  if (
    !node ||
    ![node.x, node.y, node.width, node.height].every(Number.isFinite)
  )
    return null;
  const aspect =
    viewport?.width > 0 && viewport?.height > 0
      ? viewport.width / viewport.height
      : 1.4;
  const height = Math.max(
    node.height + padding * 2,
    (node.width + padding * 2) / aspect,
    viewport?.height || 0,
    180,
  );
  const width = height * aspect;
  return [
    node.x + node.width / 2 - width / 2,
    node.y + node.height / 2 - height / 2,
    width,
    height,
  ];
}
