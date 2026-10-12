import { loadObstacleRouter, rectanglesOverlap, routeObstacles } from './obstacle-router.mjs';
import { sectionsOf } from './metrics.mjs';

const failure = (code, message, details = {}) => Object.assign(new Error(message), { code, ...details });

// Saved diagram positions are presentation state. Never read or write the
// editor's table.x/y or reviewPlacement while restoring a named diagram.
export function diagramViewPositions(projection, diagramView) {
  if (projection.level !== 'overview') return new Map();
  const nodes = new Map(projection.nodes.filter(n => n.kind === 'table').map(n => [n.tableId, n]));
  const positions = new Map();
  for (const depict of diagramView?.depicts || []) {
    const node = nodes.get(depict.tableId);
    if (!node || depict.x == null && depict.y == null) continue;
    if (![depict.x, depict.y].every(value => Number.isFinite(value) && value >= 0 && value <= 1e7))
      throw failure('DIAGRAM_VIEW_POSITION_INVALID', '命名视图中的表位置需要完整的 0 到 10000000 范围内 x/y 坐标', { tableId: depict.tableId });
    if (positions.has(node.id))
      throw failure('DIAGRAM_VIEW_POSITION_INVALID', '命名视图重复保存了同一张表的位置', { tableId: depict.tableId });
    positions.set(node.id, { x: depict.x, y: depict.y });
  }
  const pinned = [];
  for (const node of nodes.values()) if (positions.has(node.id)) {
    const box = { ...node, ...positions.get(node.id) }, conflict = pinned.find(other => rectanglesOverlap(box, other));
    if (conflict) throw failure('DIAGRAM_VIEW_POSITION_CONFLICT', '命名视图中固定的两张表互相重叠，请移动其中一张', { nodeIds: [conflict.id, node.id] });
    pinned.push(box);
  }
  return positions;
}

export function projectionForDiagramPositions(projection, positions) {
  if (!positions.size) return projection;
  return { ...projection, nodes: projection.nodes.map(node => {
    if (!positions.has(node.id) || !node.placement) return node;
    const { placement, ...next } = node;
    return next;
  }) };
}

export function diagramPositionsMatch(layout, positions) {
  const geometry = new Map(layout.children.map(n => [n.id, n]));
  return [...positions].every(([id, p]) => {
    const node = geometry.get(id);
    return node && Math.abs(node.x - p.x) < .001 && Math.abs(node.y - p.y) < .001;
  });
}

function nodeNeighbors(projection) {
  const owners = new Map(projection.nodes.flatMap(n => n.ports.map(p => [p.id, n.id])));
  const neighbors = new Map(projection.nodes.map(n => [n.id, new Set()]));
  for (const edge of projection.edges) for (const a of edge.sources) for (const b of edge.targets) {
    const source = owners.get(a), target = owners.get(b);
    if (source && target && source !== target) { neighbors.get(source).add(target); neighbors.get(target).add(source); }
  }
  return neighbors;
}

// Pin exactly the saved nodes. Other nodes retain their ELK position where it
// is free, or move to a nearby clear slot; this also places virtual net labels.
export function applyDiagramPositions(projection, input, positions) {
  if (!positions.size) return input;
  const layout = structuredClone(input), geometry = new Map(layout.children.map(n => [n.id, n]));
  const occupied = [];
  for (const [id, point] of positions) {
    const node = geometry.get(id);
    if (!node) throw failure('DIAGRAM_VIEW_POSITION_INVALID', '命名视图位置对应的表不在布局结果中', { nodeId: id });
    Object.assign(node, point);
    const conflict = occupied.find(other => rectanglesOverlap(node, other));
    if (conflict) throw failure('DIAGRAM_VIEW_POSITION_CONFLICT', '命名视图中固定的两张表互相重叠，请移动其中一张', { nodeIds: [conflict.id, node.id] });
    occupied.push(node);
  }
  const meta = new Map(projection.nodes.map(n => [n.id, n])), neighbors = nodeNeighbors(projection);
  const movable = layout.children.filter(n => !positions.has(n.id)).sort((a, b) =>
    Number(meta.get(b.id).kind === 'table') - Number(meta.get(a.id).kind === 'table') || a.id.localeCompare(b.id));
  for (const node of movable) {
    const table = meta.get(node.id).kind === 'table';
    const free = p => (!table || [p.x, p.y].every(value => Number.isFinite(value) && value >= 0 && value <= 1e7)) &&
      !occupied.some(other => rectanglesOverlap({ ...node, ...p }, other, 48));
    if (!free(node)) {
      const peers = [...neighbors.get(node.id)].map(id => geometry.get(id)).filter(n => occupied.includes(n));
      const anchors = [...peers, ...occupied];
      const candidates = anchors.flatMap(other => [
        { x: other.x + other.width + 80, y: other.y },
        { x: other.x, y: other.y + other.height + 80 },
        { x: other.x - node.width - 80, y: other.y },
        { x: other.x, y: other.y - node.height - 80 },
      ]);
      const distance = p => Math.abs(p.x - node.x) + Math.abs(p.y - node.y) +
        peers.reduce((sum, other) => sum + (Math.abs(p.x - other.x) + Math.abs(p.y - other.y)) / Math.max(1, peers.length), 0);
      const best = candidates.filter(free).sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x)[0];
      // A row below every occupied box is always available without moving a pin.
      const next = best || { x: node.x, y: Math.max(...occupied.map(n => n.y + n.height)) + 80 };
      if (!free(next)) throw failure('DIAGRAM_VIEW_POSITION_INVALID', '当前视图没有可保存的空余位置，请重新整理视图', { nodeId: node.id });
      Object.assign(node, next);
    }
    occupied.push(node);
  }
  layout.edges = [];
  return layout;
}

function refreshBounds(layout) {
  const points = [...layout.children.flatMap(n => [n, { x: n.x + n.width, y: n.y + n.height }]),
    ...layout.edges.flatMap(e => [...sectionsOf(e).flat(), ...(e.labels || []).flatMap(l => [l, { x: l.x + l.width, y: l.y + l.height }])])];
  const left = Math.min(0, ...points.map(p => p.x)) - 40, top = Math.min(0, ...points.map(p => p.y)) - 40;
  const right = Math.max(0, ...points.map(p => p.x)) + 40, bottom = Math.max(0, ...points.map(p => p.y)) + 40;
  layout.width = right - left; layout.height = bottom - top;
  layout.bounds = { x: left, y: top, width: layout.width, height: layout.height };
  return layout;
}

function refreshDomainGroups(layout) {
  if (!layout.domainGroups) return layout;
  const nodes = new Map(layout.children.map(n => [n.id, n]));
  layout.domainGroups = layout.domainGroups.map(group => {
    const members = group.nodeIds.map(id => nodes.get(id)).filter(Boolean);
    const x = Math.min(...members.map(n => n.x)) - 32, y = Math.min(...members.map(n => n.y)) - 32;
    return { ...group, x, y, width: Math.max(...members.map(n => n.x + n.width)) - x + 32,
      height: Math.max(...members.map(n => n.y + n.height)) - y + 32 };
  });
  return layout;
}

// libavoid normalizes the complete result to a 40px margin. Restore the one
// shared translation afterwards, so both nodes and wires keep saved positions.
export async function routeDiagramGeometry(projection, seed, positions = new Map()) {
  if (!projection.edges.length) return refreshDomainGroups(refreshBounds({ ...structuredClone(seed), edges: [] }));
  const layout = routeObstacles(await loadObstacleRouter(), projection, seed);
  if (!positions.size) return refreshDomainGroups(layout);
  const [id, point] = positions.entries().next().value;
  const anchor = layout.children.find(node => node.id === id);
  const dx = point.x - anchor.x, dy = point.y - anchor.y;
  for (const node of layout.children) { node.x += dx; node.y += dy; }
  for (const edge of layout.edges) for (const p of [...sectionsOf(edge).flat(), ...(edge.labels || [])]) { p.x += dx; p.y += dy; }
  if (!diagramPositionsMatch(layout, positions))
    throw failure('DIAGRAM_VIEW_POSITION_INVALID', '布线结果改变了命名视图的固定位置');
  return refreshDomainGroups(refreshBounds(layout));
}
