import { elkGraph } from './elk-graph.mjs';
import { placementHints, placementPositions, satisfiesPlacement } from './placement.mjs';
import { scoreLayout, validateLayout } from './metrics.mjs';
import { cohesiveGroups, layoutQuality, compareCandidates } from './layout-quality.mjs';
import { movePorts } from './ports.mjs';
export { movePorts } from './ports.mjs';

export function portSuggestions(projection, layout, limit = 4) {
  const geometry = new Map(layout.children.map(n => [n.id, n]));
  const owners = new Map(projection.nodes.flatMap(n => n.ports.map(p => [p.id, n]))), adjacency = new Map();
  for (const e of projection.edges) for (const a of e.sources) for (const b of e.targets) {
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a).push(b); adjacency.get(b).push(a);
  }
  const suggestions = [];
  for (const n of projection.nodes.filter(n => n.kind === 'table')) for (const port of n.ports) {
    const neighbors = (adjacency.get(port.id) || []).map(id => owners.get(id)).filter(other => other && other.id !== n.id);
    if (!neighbors.length) continue; // Keep self-loop entry and exit distinct.
    const xs = neighbors.map(other => geometry.get(other.id).x + other.width / 2).sort((a, b) => a - b);
    const distance = xs[Math.floor(xs.length / 2)] - (geometry.get(n.id).x + n.width / 2);
    if (Math.abs(distance) < n.width * .25) continue;
    const side = distance > 0 ? 'EAST' : 'WEST';
    if (side !== port.layoutOptions['elk.port.side']) suggestions.push({ id: port.id, side, benefit: Math.abs(distance) });
  }
  return suggestions.sort((a, b) => b.benefit - a.benefit || a.id.localeCompare(b.id)).slice(0, limit);
}

function groupSeed(projection, base) {
  const next = structuredClone(base), geometry = new Map(next.children.map(n => [n.id, n]));
  const degree = new Map();
  for (const net of projection.nets) for (const r of net.members) for (const id of [r.startTableId, r.endTableId]) degree.set(id, (degree.get(id) || 0) + 1);
  for (const group of cohesiveGroups(projection)) {
    const members = projection.nodes.filter(n => n.kind === 'table' && group.tableIds.includes(n.tableId));
    const anchor = [...members].sort((a, b) => (degree.get(b.tableId) || 0) - (degree.get(a.tableId) || 0) || a.id.localeCompare(b.id))[0];
    const origin = geometry.get(anchor.id);
    let row = 0;
    for (const node of members.filter(n => n.id !== anchor.id && !n.placement)) {
      const target = geometry.get(node.id);
      target.y = origin.y + (row++ % 2 ? origin.height + 48 : 0);
    }
  }
  return next;
}

export async function optimizeLayouts(baselines, elk, options) {
  const results = [...baselines];
  const initial = [...baselines].sort(compareCandidates).slice(0, 2);
  if (initial[0].projection.nodes.length > 250) return results; // Keep large diagrams within the worker deadline.
  for (const base of initial) {
    const suggestions = portSuggestions(base.projection, base.layout, base.projection.nodes.length > 80 ? 2 : 6);
    const combinations = [[], ...suggestions.map(s => [s])];
    for (let i = 0; i < suggestions.length; i++) for (let j = i + 1; j < suggestions.length; j++) combinations.push([suggestions[i], suggestions[j]]);
    if (suggestions.length > 2) combinations.push(suggestions);
    const run = async (changes, seed, strategy = 'BRANDES_KOEPF') => {
      const projection = movePorts(base.projection, changes), hints = placementHints(projection);
      const positions = placementPositions(seed, hints);
      const graph = elkGraph(projection, { ...base.layout.layoutOptions,
        'elk.layered.cycleBreaking.strategy': 'INTERACTIVE', 'elk.layered.layering.strategy': 'INTERACTIVE',
        'elk.layered.crossingMinimization.semiInteractive': 'true', 'elk.layered.nodePlacement.strategy': strategy,
        'elk.spacing.nodeNode': '48', 'elk.layered.spacing.nodeNodeBetweenLayers': '70',
        'elk.spacing.edgeNode': '16', 'elk.spacing.edgeEdge': '10',
      }, positions);
      const layout = await elk.layout(graph);
      validateLayout(layout, projection);
      const metrics = scoreLayout(layout, projection), quality = layoutQuality(layout, projection, metrics, options.targetAspectRatio);
      if (metrics.overlaps || quality.nodeIntrusions || !satisfiesPlacement(layout, hints)) return;
      results.push({ ...base, projection, layout, metrics, quality, optimization: `compact / ${changes.length} ports / ${strategy}` });
    };
    // Optional optimization failures leave the already-valid baseline available.
    for (const changes of combinations) try { await run(changes, base.layout); } catch { /* reject this candidate */ }
    const best = [...results].sort(compareCandidates)[0];
    const chosen = suggestions.filter(change => best.projection.nodes.some(n => n.ports.some(p => p.id === change.id && p.layoutOptions['elk.port.side'] === change.side)));
    try { await run(chosen, groupSeed(base.projection, base.layout)); } catch { /* keep baseline */ }
  }
  return results.sort(compareCandidates);
}
