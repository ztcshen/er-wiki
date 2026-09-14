import { rectanglesOverlap } from './obstacle-router.mjs';
import { placementHints, satisfiesPlacement } from './placement.mjs';
import { cohesiveGroups } from './layout-quality.mjs';

export function tableNeighbors(projection) {
  const byTable = new Map(projection.nodes.filter(n => n.kind === 'table').map(n => [n.tableId, n.id]));
  const neighbors = new Map([...byTable.values()].map(id => [id, new Set()]));
  for (const net of projection.nets) for (const r of net.members) {
    const a = byTable.get(r.startTableId), b = byTable.get(r.endTableId);
    if (a && b && a !== b) { neighbors.get(a).add(b); neighbors.get(b).add(a); }
  }
  return neighbors;
}

// Virtual bus junctions must not permanently reserve an otherwise useful table
// slot. Move an obstructing junction to the nearest clear side, then reroute it.
export function settleJunctions(projection, children) {
  const virtual = new Set(projection.nodes.filter(n => ['hub', 'junction'].includes(n.kind)).map(n => n.id));
  const next = structuredClone(children);
  for (const node of next.filter(n => virtual.has(n.id))) {
    const obstacles = next.filter(n => n.id !== node.id);
    const hits = obstacles.filter(n => rectanglesOverlap(node, n, 32));
    if (!hits.length) continue;
    const options = hits.flatMap(n => [
      { ...node, x: n.x - node.width - 48 }, { ...node, x: n.x + n.width + 48 },
      { ...node, y: n.y - node.height - 48 }, { ...node, y: n.y + n.height + 48 },
    ]).filter(p => !obstacles.some(n => rectanglesOverlap(p, n, 32)))
      .sort((a, b) => Math.abs(a.x - node.x) + Math.abs(a.y - node.y) - Math.abs(b.x - node.x) - Math.abs(b.y - node.y));
    if (!options.length) return null;
    Object.assign(node, options[0]);
  }
  return next;
}

// Topology identifies attached leaves, never a table name or a business type.
// Geometry comes from measured card sizes and neighboring rows/corridors.
export function positionCandidates(projection, layout, limit = 120) {
  const geometry = new Map(layout.children.map(n => [n.id, n]));
  const virtual = new Set(projection.nodes.filter(n => ['hub', 'junction'].includes(n.kind)).map(n => n.id));
  const neighbors = tableNeighbors(projection), hints = placementHints(projection);
  const candidates = [], seen = new Set(), gap = 80;
  const add = (node, x, y, kind) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const original = geometry.get(node.id), moved = { ...original, x, y };
    const key = `${node.id}:${Math.round(x)}:${Math.round(y)}`;
    if (seen.has(key) || Math.abs(x - original.x) + Math.abs(y - original.y) < 8) return;
    seen.add(key);
    if (layout.children.some(n => n.id !== node.id && !virtual.has(n.id) && rectanglesOverlap(moved, n, 48))) return;
    const children = layout.children.map(n => n.id === node.id ? moved : n);
    if (!satisfiesPlacement({ children }, hints)) return;
    const width = Math.max(...children.map(n => n.x + n.width)) - Math.min(...children.map(n => n.x));
    const height = Math.max(...children.map(n => n.y + n.height)) - Math.min(...children.map(n => n.y));
    const adjacent = [...(neighbors.get(node.id) || [])].map(id => geometry.get(id));
    const distance = adjacent.reduce((sum, n) => sum + Math.abs(x + moved.width / 2 - n.x - n.width / 2) + Math.abs(y + moved.height / 2 - n.y - n.height / 2), 0);
    candidates.push({ nodeId: node.id, x, y, kind, estimate: width + height + distance / Math.max(1, adjacent.length) });
  };
  for (const node of projection.nodes.filter(n => n.kind === 'table' && !n.placement)) {
    const n = geometry.get(node.id), adjacent = [...neighbors.get(node.id)].map(id => geometry.get(id));
    if (!adjacent.length) continue;
    if (adjacent.length === 1) {
      const a = adjacent[0];
      for (const x of [a.x, a.x + (a.width - n.width) / 2, a.x + a.width - n.width]) {
        add(node, x, a.y - n.height - gap, 'leaf-above');
        add(node, x, a.y + a.height + gap, 'leaf-below');
      }
      for (const y of [a.y, a.y + (a.height - n.height) / 2, a.y + a.height - n.height]) {
        add(node, a.x - n.width - gap, y, 'leaf-left');
        add(node, a.x + a.width + gap, y, 'leaf-right');
      }
    }
    // Shift into existing free columns/rows, including across former ELK layers.
    for (const other of layout.children.filter(v => v.id !== n.id)) {
      for (const x of [other.x, other.x + other.width + gap, other.x - n.width - gap]) add(node, x, n.y, 'free-column');
      for (const y of [other.y, other.y + other.height + gap, other.y - n.height - gap]) add(node, n.x, y, 'free-row');
    }
    const xs = adjacent.map(v => v.x).sort((a, b) => a - b), ys = adjacent.map(v => v.y).sort((a, b) => a - b);
    add(node, xs[Math.floor(xs.length / 2)], n.y, 'neighbor-column');
    add(node, n.x, ys[Math.floor(ys.length / 2)], 'neighbor-row');
  }
  // Give each table a quota so a busy core cannot consume the entire search.
  const byNode = new Map();
  for (const candidate of candidates.sort((a, b) => a.estimate - b.estimate)) {
    if (!byNode.has(candidate.nodeId)) byNode.set(candidate.nodeId, []);
    byNode.get(candidate.nodeId).push(candidate);
  }
  const balanced = [];
  for (let i = 0; balanced.length < limit; i++) {
    const row = [...byNode.values()].flatMap(list => list[i] ? [list[i]] : []);
    if (!row.length) break;
    balanced.push(...row);
  }
  const groupMoves = [];
  for (const group of cohesiveGroups(projection)) {
    const members = projection.nodes.filter(n => n.kind === 'table' && group.tableIds.includes(n.tableId));
    if (members.length > 8 || members.some(n => n.placement)) continue;
    const ids = new Set(members.map(n => n.id)), placed = members.map(n => geometry.get(n.id));
    const left = Math.min(...placed.map(n => n.x)), top = Math.min(...placed.map(n => n.y));
    for (const target of layout.children.filter(n => !ids.has(n.id))) for (const axis of ['x', 'y']) {
      const delta = target[axis] - (axis === 'x' ? left : top);
      if (Math.abs(delta) < 8) continue;
      const moves = placed.map(n => ({ nodeId: n.id, x: n.x + (axis === 'x' ? delta : 0), y: n.y + (axis === 'y' ? delta : 0) }));
      const byId = new Map(moves.map(m => [m.nodeId, m]));
      const children = layout.children.map(n => byId.has(n.id) ? { ...n, ...byId.get(n.id) } : n);
      if (children.some(n => ids.has(n.id) && children.some(other => !ids.has(other.id) && !virtual.has(other.id) && rectanglesOverlap(n, other, 48)))) continue;
      if (!satisfiesPlacement({ children }, hints)) continue;
      groupMoves.push({ moves, kind: 'connected-group-' + axis });
    }
  }
  return [...groupMoves.slice(0, 24), ...balanced.slice(0, limit)];
}
