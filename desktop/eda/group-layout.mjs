import { elkGraph } from './elk-graph.mjs';
import { validateLayout } from './metrics.mjs';
import { ALL_DOMAIN } from './model.mjs';

// Assign virtual junctions and labels to the domain of their adjacent table.
// Final relationship identities remain in the original full projection.
export function domainLayoutGroups(projection) {
  const domains = new Map(projection.domains.map(domain => [domain.id, domain]));
  const domainByTable = new Map(projection.domains.flatMap(d => d.tableIds.map(id => [id, d.id])));
  const assigned = new Map(projection.nodes.filter(n => n.kind === 'table').map(n => [n.id, domainByTable.get(n.tableId) || ALL_DOMAIN]));
  const owners = new Map(projection.nodes.flatMap(n => n.ports.map(port => [port.id, n.id])));
  const adjacent = new Map(projection.nodes.map(n => [n.id, []]));
  for (const edge of projection.edges) for (const a of edge.sources) for (const b of edge.targets) {
    const from = owners.get(a), to = owners.get(b);
    if (from && to && from !== to) { adjacent.get(from).push(to); adjacent.get(to).push(from); }
  }
  let pending = projection.nodes.filter(n => !assigned.has(n.id));
  while (pending.length) {
    const remaining = [];
    for (const node of pending) {
      const counts = new Map();
      for (const neighbor of adjacent.get(node.id)) if (assigned.has(neighbor)) {
        const domain = assigned.get(neighbor); counts.set(domain, (counts.get(domain) || 0) + 1);
      }
      const best = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      if (best) assigned.set(node.id, best[0]); else remaining.push(node);
    }
    if (remaining.length === pending.length) { remaining.forEach(node => assigned.set(node.id, ALL_DOMAIN)); break; }
    pending = remaining;
  }
  const groups = new Map();
  for (const node of projection.nodes) {
    const id = assigned.get(node.id);
    if (!groups.has(id)) groups.set(id, { id, name: domains.get(id)?.name || '公共结构', nodeIds: [], tableIds: [] });
    const group = groups.get(id); group.nodeIds.push(node.id);
    if (node.kind === 'table') group.tableIds.push(node.tableId);
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function domainLayoutEligibility(projection, options = {}) {
  if (options.groupLayout === false || projection.level !== 'overview') return { eligible: false, reason: 'disabled' };
  // Global WASM routing is synchronous. Preserve the early baseline and the
  // worker's deadline for larger projections rather than starting extra work.
  if (projection.nodes.length > 80) return { eligible: false, reason: 'size' };
  const groups = domainLayoutGroups(projection);
  if (groups.length < 2 || !groups.some(g => g.id !== ALL_DOMAIN && g.tableIds.length > 1)) return { eligible: false, reason: 'no-groups' };
  if (groups.length > 24) return { eligible: false, reason: 'group-count' };
  return { eligible: true, groups };
}

const stopped = options => !!options.budget?.expired();

// ELK first places each domain independently. A second ELK graph places domain
// rectangles as a whole, then the caller routes every original edge globally.
export async function arrangeDomainGroups(projection, elk, options = {}) {
  const eligibility = domainLayoutEligibility(projection, options);
  if (!eligibility.eligible || stopped(options)) return null;
  const direction = options.direction === 'DOWN' ? 'DOWN' : 'RIGHT';
  const layoutOptions = { 'elk.algorithm': 'layered', 'elk.edgeRouting': 'ORTHOGONAL', 'elk.direction': direction,
    'elk.randomSeed': '11', 'elk.spacing.nodeNode': '65', 'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    'elk.spacing.edgeNode': '22', 'elk.spacing.edgeEdge': '14', 'elk.padding': '[top=32,left=32,bottom=32,right=32]' };
  const owners = new Map(projection.nodes.flatMap(n => n.ports.map(p => [p.id, n.id])));
  const grouped = [];
  for (const group of eligibility.groups) {
    if (stopped(options)) return null;
    const ids = new Set(group.nodeIds), nodes = projection.nodes.filter(n => ids.has(n.id));
    const edges = projection.edges.filter(e => [...e.sources, ...e.targets].every(id => ids.has(owners.get(id))));
    const innerProjection = { ...projection, nodes, edges };
    const inner = await elk.layout(elkGraph(innerProjection, layoutOptions));
    validateLayout(inner, innerProjection);
    const x = Math.min(...inner.children.map(n => n.x)), y = Math.min(...inner.children.map(n => n.y));
    const width = Math.max(...inner.children.map(n => n.x + n.width)) - x + 64;
    const height = Math.max(...inner.children.map(n => n.y + n.height)) - y + 64;
    grouped.push({ ...group, layoutId: 'domain-layout:' + JSON.stringify(group.id), width, height,
      children: inner.children.map(n => ({ ...n, x: n.x - x + 32, y: n.y - y + 32 })) });
  }
  if (stopped(options)) return null;
  const groupByNode = new Map(grouped.flatMap(group => group.nodeIds.map(id => [id, group.layoutId])));
  const links = new Map();
  for (const edge of projection.edges) for (const a of edge.sources) for (const b of edge.targets) {
    const from = groupByNode.get(owners.get(a)), to = groupByNode.get(owners.get(b));
    if (!from || !to || from === to) continue;
    const key = JSON.stringify([from, to]);
    if (!links.has(key)) links.set(key, { id: 'domain-link:' + key, sources: [from], targets: [to] });
  }
  const coarse = { nodes: grouped.map(group => ({ id: group.layoutId, width: group.width, height: group.height, ports: [] })), edges: [...links.values()] };
  const outer = await elk.layout(elkGraph(coarse, { ...layoutOptions, 'elk.spacing.nodeNode': '120', 'elk.layered.spacing.nodeNodeBetweenLayers': '160' }));
  validateLayout(outer, coarse);
  if (stopped(options)) return null;
  const geometry = new Map(outer.children.map(n => [n.id, n]));
  const children = grouped.flatMap(group => group.children.map(node => ({ ...node,
    x: node.x + geometry.get(group.layoutId).x, y: node.y + geometry.get(group.layoutId).y })));
  return { id: 'root', children, edges: [], width: outer.width, height: outer.height,
    domainGroups: grouped.map(group => ({ ...geometry.get(group.layoutId), id: group.id, nodeIds: group.nodeIds })),
    groupLayout: { strategy: 'two-stage-domains', domainCount: grouped.length, innerLayouts: grouped.length } };
}
