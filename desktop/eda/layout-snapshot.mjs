import { projectModel } from './model.mjs';
import { validateLayout, scoreLayout } from './metrics.mjs';
import { layoutQuality } from './layout-quality.mjs';
import { PORT_SIDES } from './ports.mjs';
import { diagramViewPositions, projectionForDiagramPositions, diagramPositionsMatch } from './diagram-geometry.mjs';
import { cardinalityBadges, bundleBadges } from './cardinality.mjs';

const coordinates = ['x', 'y', 'rowY', 'rowBadgeY', 'badgeX', 'badgeY'];
const pickCoordinates = port => Object.fromEntries(coordinates.filter(k => port[k] !== undefined).map(k => [k, port[k]]));
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const annotationCoordinates = ({ id, x, y }) => ({ id, x, y });
const near = (a, b) => Math.abs(a - b) <= .01;

function restoreAnnotationPositions(layout, projection) {
  const saved = layout.annotationPositions;
  if (saved === undefined) return;
  requireValue(saved && typeof saved === 'object', 'Invalid cached annotation positions');
  // Build the canonical anchors with current relationship semantics, never with
  // the saved overrides that are being validated.
  const canonical = { layout: { ...layout, annotationPositions: undefined }, projection };
  const badges = { cardinality: cardinalityBadges(canonical), bundles: bundleBadges(canonical) };
  const edges = new Map(layout.edges.map(edge => [edge.id, edge]));
  const bounds = layout.bounds || { x: 0, y: 0, width: layout.width, height: layout.height };
  const restored = {};
  for (const kind of ['cardinality', 'bundles']) {
    requireValue(Array.isArray(saved[kind]) && saved[kind].length === badges[kind].length, 'Cached annotations differ from model');
    const expected = new Map(badges[kind].map(badge => [badge.id, badge])), seen = new Set();
    restored[kind] = saved[kind].map(position => {
      const badge = expected.get(position?.id);
      requireValue(badge && !seen.has(position.id), 'Invalid cached annotation identity');
      seen.add(position.id);
      requireValue([position.x, position.y].every(v => Number.isFinite(v) && Math.abs(v) <= 1e8), 'Invalid cached annotation coordinates');
      const width = kind === 'cardinality' ? badge.width : 64, height = kind === 'cardinality' ? badge.height : 16;
      const original = near(position.x, badge.x) && near(position.y, badge.y);
      // Saved views may legitimately extend beyond the nominal canvas. Preserve
      // field anchors. Greedy bundle anchors can extend 92px beyond a route;
      // unlike field anchors they can change when another label is repaired.
      // Bound that legacy margin independently of obstacle-dependent fallback.
      const margin = kind === 'bundles' ? 96 : 0;
      requireValue(kind === 'cardinality' && original || position.x - width / 2 >= bounds.x - margin && position.y - height / 2 >= bounds.y - margin &&
        position.x + width / 2 <= bounds.x + bounds.width + margin && position.y + height / 2 <= bounds.y + bounds.height + margin, 'Cached annotation outside layout');
      if (kind === 'cardinality') {
        const normal = PORT_SIDES[badge.side], dx = position.x - badge.x, dy = position.y - badge.y;
        const outward = dx * normal.dx + dy * normal.dy;
        requireValue(Math.abs(dx * normal.dy - dy * normal.dx) <= .01 && outward >= -.01 && outward <= 48.01, 'Cached annotation detached from field');
      } else {
        const box = { left: position.x - 32, right: position.x + 32, top: position.y - 8, bottom: position.y + 8 };
        const close = (edges.get(position.id)?.sections || []).some(section => {
          const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
          return points.slice(1).some((b, i) => {
            const a = points[i];
            const dx = Math.max(Math.min(a.x, b.x) - box.right, box.left - Math.max(a.x, b.x), 0);
            const dy = Math.max(Math.min(a.y, b.y) - box.bottom, box.top - Math.max(a.y, b.y), 0);
            return Math.hypot(dx, dy) <= 38.01;
          });
        });
        requireValue(close, 'Cached annotation detached from bundle');
      }
      return annotationCoordinates(position);
    });
  }
  layout.annotationPositions = restored;
}

// Cache geometry only, never old table/column text, enum definitions or model
// records. Presentation and relation semantics are regenerated on every read.
export function layoutSnapshot(result) {
  const meta = new Map(result.projection.nodes.map(n => [n.id, n]));
  return { longCuts: result.longCuts || [], metrics: result.metrics, quality: result.quality,
    optimization: result.optimization, candidates: result.candidates,
    layout: { width: result.layout.width, height: result.layout.height,
      ...(result.layout.bounds ? { bounds: Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, result.layout.bounds[key]])) } : {}),
      ...(result.layout.annotationPositions ? { annotationPositions: Object.fromEntries(['cardinality', 'bundles'].map(kind =>
        [kind, result.layout.annotationPositions[kind].map(annotationCoordinates)])) } : {}),
      children: result.layout.children.map(n => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height,
        ports: meta.get(n.id).ports.map(p => ({ id: p.id, ...pickCoordinates(p), side: p.layoutOptions['elk.port.side'] })) })),
      edges: result.layout.edges.map(e => ({ id: e.id, sources: e.sources, targets: e.targets, sections: e.sections,
        ...(e.labels ? { labels: e.labels.map(l => ({ id: l.id, x: l.x, y: l.y, width: l.width, height: l.height })) } : {}) })),
    } };
}

export function restoreLayoutSnapshot(snapshot, model, options) {
  requireValue(Array.isArray(snapshot?.longCuts), 'Invalid layout cache cuts');
  const relations = new Set(model.relationships.map(r => r.id));
  requireValue(snapshot.longCuts.every(id => relations.has(id)), 'Unknown cached relationship');
  const projected = projectModel(model, options, new Set(snapshot.longCuts));
  const positions = diagramViewPositions(projected, options.diagramView);
  const projection = projectionForDiagramPositions(projected, positions);
  const layout = structuredClone(snapshot.layout);
  requireValue(layout && [layout.width, layout.height].every(v => Number.isFinite(v) && v > 0 && v <= 1e8), 'Invalid cached layout size');
  if (layout.bounds !== undefined) {
    requireValue(layout.bounds && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(layout.bounds[key]) && Math.abs(layout.bounds[key]) <= 1e8) &&
      layout.bounds.width === layout.width && layout.bounds.height === layout.height, 'Invalid cached layout bounds');
    layout.bounds = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, layout.bounds[key]]));
  }
  const nodes = new Map(layout.children.map(n => [n.id, n]));
  requireValue(nodes.size === projection.nodes.length && nodes.size === layout.children.length, 'Cached nodes differ from model');
  requireValue(diagramPositionsMatch(layout, positions), 'Cached diagram positions differ from saved view');
  for (const n of projection.nodes) {
    const saved = nodes.get(n.id);
    requireValue(saved && saved.width === n.width && saved.height === n.height, 'Cached node size differs');
    const ports = new Map(saved.ports.map(p => [p.id, p]));
    requireValue(ports.size === n.ports.length && ports.size === saved.ports.length, 'Cached ports differ');
    n.ports = n.ports.map(p => {
      const savedPort = ports.get(p.id);
      requireValue(savedPort && PORT_SIDES[savedPort.side] && Object.values(pickCoordinates(savedPort)).every(Number.isFinite), 'Invalid cached port');
      requireValue(Number.isFinite(savedPort.x) && Number.isFinite(savedPort.y) && savedPort.x >= 0 && savedPort.x <= n.width && savedPort.y >= 0 && savedPort.y <= n.height, 'Cached port outside node');
      const side = savedPort.side;
      requireValue(side === 'NORTH' ? savedPort.y === 0 : side === 'SOUTH' ? savedPort.y === n.height : side === 'EAST' ? savedPort.x === n.width : savedPort.x === 0, 'Cached port outside its side');
      return { ...p, ...pickCoordinates(savedPort), layoutOptions: { ...p.layoutOptions, 'elk.port.side': side } };
    });
    saved.ports = structuredClone(n.ports);
  }
  const edges = new Map(projection.edges.map(e => [e.id, e]));
  const endpoints = new Map(projection.nodes.flatMap(n => n.ports.map(p => [p.id, { x: nodes.get(n.id).x + p.x, y: nodes.get(n.id).y + p.y }])));
  requireValue(new Set(layout.edges.map(e => e.id)).size === projection.edges.length, 'Cached edges differ');
  for (const e of layout.edges) {
    const current = edges.get(e.id);
    requireValue(current && JSON.stringify(e.sources) === JSON.stringify(current.sources) && JSON.stringify(e.targets) === JSON.stringify(current.targets), 'Cached edge endpoints differ');
    const at = (a, b) => a && b && Math.abs(a.x - b.x) < .01 && Math.abs(a.y - b.y) < .01;
    requireValue(current.sources.every(id => e.sections?.some(s => at(s.startPoint, endpoints.get(id)))) && current.targets.every(id => e.sections?.some(s => at(s.endPoint, endpoints.get(id)))), 'Cached wire detached from field pin');
    const labels = new Map((current.labels || []).map(l => [l.id, l]));
    requireValue((e.labels || []).length === labels.size, 'Cached labels differ');
    if (e.labels) e.labels = e.labels.map(l => {
      const fresh = labels.get(l.id);
      requireValue(fresh && [l.x, l.y].every(Number.isFinite) && fresh.width === l.width && fresh.height === l.height, 'Invalid cached label');
      return { ...fresh, x: l.x, y: l.y };
    });
  }
  validateLayout(layout, projection);
  restoreAnnotationPositions(layout, projection);
  requireValue(['crossings', 'overlaps', 'length', 'bends'].every(k => Number.isFinite(snapshot.metrics?.[k])), 'Invalid cached metrics');
  requireValue(Array.isArray(snapshot.candidates), 'Invalid cached candidates');
  const metrics = scoreLayout(layout, projection);
  return { ...snapshot, projection, layout, metrics, quality: layoutQuality(layout, projection, metrics) };
}
