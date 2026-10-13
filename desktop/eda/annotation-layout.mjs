import { cardinalityBadges, bundleBadges } from './cardinality.mjs';
import { PORT_SIDES } from './ports.mjs';
import { sectionsOf } from './metrics.mjs';
import { AnnotationIndex, boundingBox, boxOverlap, segmentHitsBox, routeAnnotationCandidates } from './annotation-geometry.mjs';

const badgeBox = b => ({ x: b.x - b.width / 2, y: b.y - b.height / 2, width: b.width, height: b.height });
const finiteBox = b => [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width > 0 && b.height > 0;
const epsilon = 1e-6; // SVG units: stable comparisons, not a product-specific native constant.

function collectGroups(layout, projection) {
  const result = { layout, projection }, groups = [];
  const original = { layout: { ...layout, annotationPositions: undefined }, projection };
  const canonical = new Map(cardinalityBadges(original).map(b => [b.id, b]));
  for (const b of cardinalityBadges(result)) groups.push({ id: `cardinality:${b.id}`, kind: 'cardinality', refs: b.refs,
    badgeId: b.id, boxes: [badgeBox(b)], anchor: badgeBox(canonical.get(b.id)), normal: PORT_SIDES[b.side] });
  const meta = new Map(projection.edges.map(e => [e.id, e]));
  const segments = [], segmentsByEdge = new Map();
  for (const edge of layout.edges || []) {
    const own = sectionsOf(edge).flatMap(points => points.slice(1).map((b, i) => {
      const a = points[i];
      return { a, b, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y),
        length: Math.abs(a.x - b.x) + Math.abs(a.y - b.y), refs: meta.get(edge.id)?.refs || [] };
    }));
    segments.push(...own);
    segmentsByEdge.set(edge.id, own);
    if (edge.labels?.length && edge.labels.every(finiteBox)) groups.push({ id: `labels:${edge.id}`, kind: 'labels',
      refs: meta.get(edge.id)?.refs || [], edgeId: edge.id, boxes: edge.labels.map(l => ({ x: l.x, y: l.y, width: l.width, height: l.height })), segments: own });
  }
  for (const b of bundleBadges(result)) groups.push({ id: `bundle:${b.id}`, kind: 'bundles', badgeId: b.id, refs: b.refs,
    boxes: [badgeBox({ ...b, width: 64, height: 16 })], segments: segmentsByEdge.get(b.id) || [] });
  for (const group of groups) { group.origin = boundingBox(group.boxes); group.offset = { x: 0, y: 0 }; }
  return { groups, segments };
}

// Independent, bounded label placement after routing. Original geometry is a
// candidate in every round; a rejected group never leaks partial coordinates.
// Shared-port 1/N badges are already atomic groups; all labels on one edge move
// together. Tables, ports, paths and semantic model records are never changed.
export function optimizeAnnotations(layout, projection, options = {}) {
  if (options.annotations === false || options.budget?.expired()) return layout;
  const now = options.budget?.now || (() => performance.now()), start = now();
  const duration = Math.max(0, Math.min(options.annotationBudgetMs ?? 60, options.budget?.remaining?.() ?? Infinity));
  if (!duration) return layout;
  const maxEvaluations = Math.max(0, Math.min(options.annotationMaxEvaluations ?? 12000, 50000));
  const { groups, segments } = collectGroups(layout, projection);
  if (!groups.length) return layout;
  const bounds = layout.bounds || { x: 0, y: 0, width: layout.width, height: layout.height };
  const nodes = new AnnotationIndex(layout.children || []), wires = new AnnotationIndex(segments);
  const allBoxes = () => groups.flatMap(g => g.boxes.map(box => ({ ...box, groupId: g.id, kind: g.kind })));
  let annotations = new AnnotationIndex(allBoxes()), evaluated = 0, acceptedGroups = 0, rounds = 0, stopReason = 'completed';
  const expired = () => {
    if (evaluated >= maxEvaluations) { stopReason = 'limit'; return true; }
    if (now() - start >= duration || options.budget?.expired()) { stopReason = 'budget'; return true; }
    return false;
  };
  const score = (group, boxes, offset) => {
    // Per-class non-regression prevents trading a label/node collision for a
    // badge or foreign-wire collision with the same aggregate count.
    let labels = 0, badges = 0, intrusions = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      for (const n of nodes.query(box)) if (boxOverlap(box, n)) group.kind === 'labels' ? labels++ : badges++;
      for (const other of annotations.query(box)) if (other.groupId !== group.id && boxOverlap(box, other)) {
        if (group.kind === 'labels' && other.kind === 'labels') labels++; else badges++;
      }
      for (let j = 0; j < i; j++) if (boxOverlap(box, boxes[j])) group.kind === 'labels' ? labels++ : badges++;
      for (const segment of wires.query(box)) if (!segment.refs.some(id => group.refs.includes(id)) && segmentHitsBox(segment, box)) intrusions++;
    }
    return { labels, badges, intrusions, conflicts: labels + badges + intrusions, distance: Math.hypot(offset.x, offset.y) };
  };
  const improves = (a, b) => ['labels', 'badges', 'intrusions'].every(k => a[k] <= b[k]) &&
    (a.conflicts < b.conflicts || a.conflicts === b.conflicts && a.distance < b.distance - epsilon);
  const selected = options.annotationRelations ? new Set(options.annotationRelations) : null;
  // Stable stage order: field maxima, related captions, then summary counts.
  const ordered = [...groups].sort((a, b) => ['cardinality', 'labels', 'bundles'].indexOf(a.kind) - ['cardinality', 'labels', 'bundles'].indexOf(b.kind) || a.id.localeCompare(b.id));
  for (let round = 0; round < 3 && !expired(); round++) {
    rounds++; let changed = false;
    for (const group of ordered) {
      if (expired()) break;
      if (selected && !group.refs.some(id => selected.has(id))) continue;
      const before = score(group, group.boxes, group.offset);
      if (!before.conflicts && !before.distance) continue;
      let best = { boxes: group.boxes, offset: group.offset, score: before };
      const positions = group.kind === 'cardinality'
        ? [0, 8, 16, 24, 32, 48].map(d => ({ x: group.anchor.x + group.normal.dx * d, y: group.anchor.y + group.normal.dy * d }))
        : [group.origin, ...routeAnnotationCandidates(group.origin, group.segments)];
      const seen = new Set();
      for (const point of positions) {
        if (expired()) break;
        const key = `${point.x.toFixed(4)}:${point.y.toFixed(4)}`;
        if (seen.has(key)) continue; seen.add(key);
        const offset = { x: point.x - group.origin.x, y: point.y - group.origin.y };
        const boxes = group.boxes.map(box => ({ ...box, x: box.x + offset.x - group.offset.x, y: box.y + offset.y - group.offset.y }));
        if (boxes.some(b => b.x < bounds.x || b.y < bounds.y || b.x + b.width > bounds.x + bounds.width || b.y + b.height > bounds.y + bounds.height)) continue;
        evaluated++;
        const next = score(group, boxes, offset);
        if (improves(next, best.score)) best = { boxes, offset, score: next };
      }
      if (best.score !== before) {
        group.boxes = best.boxes; group.offset = best.offset;
        acceptedGroups++; changed = true; annotations = new AnnotationIndex(allBoxes());
      }
    }
    if (!changed) break;
  }
  const labels = new Map(groups.filter(g => g.kind === 'labels').map(g => [g.edgeId, g]));
  const positions = kind => groups.filter(g => g.kind === kind).map(g => ({ id: g.badgeId,
    x: g.boxes[0].x + g.boxes[0].width / 2, y: g.boxes[0].y + g.boxes[0].height / 2 }));
  return { ...layout, edges: layout.edges.map(edge => labels.has(edge.id) ? { ...edge,
    labels: edge.labels.map((label, i) => ({ ...label, x: labels.get(edge.id).boxes[i].x, y: labels.get(edge.id).boxes[i].y })) } : edge),
    annotationPositions: { cardinality: positions('cardinality'), bundles: positions('bundles') },
    annotationPlacement: { groups: groups.length, acceptedGroups, evaluated, rounds, stopReason, elapsedMs: now() - start } };
}
