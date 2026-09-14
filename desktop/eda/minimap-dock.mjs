// Choose a quiet corner of the fitted diagram, not of the current camera. The
// minimap therefore stays still while the user pans or drags inside it.
export function minimapDock(layout, viewport) {
  const width = viewport?.width || 800, height = viewport?.height || 500;
  const mapWidth = width <= 450 ? 136 : 184, mapHeight = width <= 450 ? 118 : 148;
  const scale = Math.min(width / layout.width, height / layout.height);
  const ox = (width - layout.width * scale) / 2, oy = (height - layout.height * scale) / 2;
  const nodes = layout.children.map(n => ({ x: ox + n.x * scale, y: oy + n.y * scale, width: n.width * scale, height: n.height * scale }));
  const candidates = [
    { name: 'bottom-left', x: 12, y: height - mapHeight - 12, style: { left: 12, bottom: 12 } },
    { name: 'top-left', x: 12, y: 52, style: { left: 12, top: 52, bottom: 'auto' } },
    { name: 'top-right', x: width - mapWidth - 12, y: 52, style: { right: 12, left: 'auto', top: 52, bottom: 'auto' } },
    { name: 'bottom-right', x: width - mapWidth - 12, y: height - mapHeight - 60, style: { right: 12, left: 'auto', bottom: 60 } },
  ];
  const score = c => nodes.reduce((sum, n) => sum +
    Math.max(0, Math.min(c.x + mapWidth, n.x + n.width) - Math.max(c.x, n.x)) *
    Math.max(0, Math.min(c.y + mapHeight, n.y + n.height) - Math.max(c.y, n.y)), 0);
  return candidates.sort((a, b) => score(a) - score(b))[0];
}
