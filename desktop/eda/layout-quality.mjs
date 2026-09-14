import { sectionsOf } from './metrics.mjs';

const overlaps = (a, b) => a.x < b.x + b.width - .1 && a.x + a.width > b.x + .1 &&
  a.y < b.y + b.height - .1 && a.y + a.height > b.y + .1;

export function cohesiveGroups(projection) {
  const relations = projection.nets.flatMap(n => n.members);
  return projection.domains.filter(g => g.id !== '__unassigned__' && g.tableIds.length > 1 &&
    relations.some(r => r.startTableId !== r.endTableId && g.tableIds.includes(r.startTableId) && g.tableIds.includes(r.endTableId)));
}

export function layoutQuality(layout, projection, metrics, targetAspect = 1.8) {
  targetAspect = Number.isFinite(targetAspect) ? Math.max(.5, Math.min(4, targetAspect)) : 1.8;
  const nodes = layout.children || [], meta = new Map(projection.edges.map(e => [e.id, e]));
  const lengths = new Map(), labels = [], segments = [];
  for (const edge of layout.edges || []) {
    let length = 0;
    for (const points of sectionsOf(edge)) for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      length += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      segments.push({ a, b });
    }
    for (const id of meta.get(edge.id)?.refs || []) lengths.set(id, (lengths.get(id) || 0) + length);
    labels.push(...(edge.labels || []).filter(l => [l.x, l.y, l.width, l.height].every(Number.isFinite)));
  }
  let nodeIntrusions = 0, labelOverlaps = 0;
  for (const { a, b } of segments) for (const n of nodes) {
    const hit = Math.abs(a.y - b.y) < .01
      ? a.y > n.y + .1 && a.y < n.y + n.height - .1 && Math.max(a.x, b.x) > n.x + .1 && Math.min(a.x, b.x) < n.x + n.width - .1
      : a.x > n.x + .1 && a.x < n.x + n.width - .1 && Math.max(a.y, b.y) > n.y + .1 && Math.min(a.y, b.y) < n.y + n.height - .1;
    if (hit) nodeIntrusions++;
  }
  for (let i = 0; i < labels.length; i++) {
    labelOverlaps += nodes.filter(n => overlaps(labels[i], n)).length;
    for (let j = 0; j < i; j++) if (overlaps(labels[i], labels[j])) labelOverlaps++;
  }
  const geometry = new Map(nodes.map(n => [n.id, n]));
  let groupSpread = 0;
  for (const group of cohesiveGroups(projection)) {
    const members = projection.nodes.filter(n => n.kind === 'table' && group.tableIds.includes(n.tableId)).map(n => geometry.get(n.id)).filter(Boolean);
    if (members.length < 2) continue;
    groupSpread += Math.max(...members.map(n => n.x + n.width)) - Math.min(...members.map(n => n.x)) +
      Math.max(...members.map(n => n.y + n.height)) - Math.min(...members.map(n => n.y));
  }
  const width = layout.width || 0, height = layout.height || 0;
  const longestRelation = Math.max(0, ...lengths.values());
  const screenSpan = Math.max(width / targetAspect, height);
  // Crossings remain the first objective. Within that class, bounded penalties
  // prefer readable, compact routes without requiring every group to be a box.
  const readability = Math.round(metrics.length + .3 * longestRelation + .4 * screenSpan + .12 * groupSpread);
  return { width, height, aspectRatio: height ? width / height : 1, longestRelation,
    groupSpread: Math.round(groupSpread), nodeIntrusions, labelOverlaps, readability };
}

export function compareCandidates(a, b) {
  for (const key of ['crossings', 'overlaps']) if (a.metrics[key] !== b.metrics[key]) return a.metrics[key] - b.metrics[key];
  for (const key of ['nodeIntrusions', 'labelOverlaps', 'readability']) {
    const difference = (a.quality?.[key] || 0) - (b.quality?.[key] || 0);
    if (difference) return difference;
  }
  return a.metrics.length - b.metrics.length || a.metrics.bends - b.metrics.bends;
}
