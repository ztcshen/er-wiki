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
