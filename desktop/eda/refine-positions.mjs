import { loadObstacleRouter, routeObstacles } from './obstacle-router.mjs';
import { positionCandidates, settleJunctions } from './position-candidates.mjs';
import { portSuggestions, movePorts } from './optimize-layout.mjs';
import { scoreLayout, validateLayout } from './metrics.mjs';
import { layoutQuality, compareCandidates } from './layout-quality.mjs';
import { placementHints, satisfiesPlacement } from './placement.mjs';

export async function refinePositions(candidates, options = {}) {
  let best = [...candidates].sort(compareCandidates)[0];
  if (options.refinePositions === false || best.projection.nodes.length > 80) return candidates;
  const results = [...candidates];
  let Avoid, aborted = false;
  try { Avoid = await loadObstacleRouter(); } catch { return results; }
  const started = performance.now(), budget = options.positionBudgetMs ?? 6000;
  const route = (base, seed, changes, kind) => {
    try {
      const projection = movePorts(base.projection, changes);
      const layout = routeObstacles(Avoid, projection, seed);
      validateLayout(layout, projection);
      const metrics = scoreLayout(layout, projection), quality = layoutQuality(layout, projection, metrics, options.targetAspectRatio);
      if (metrics.overlaps || quality.nodeIntrusions || quality.labelOverlaps || !satisfiesPlacement(layout, placementHints(projection))) return;
      const result = { ...base, projection, layout, metrics, quality, optimization: `position / ${kind}` };
      if (compareCandidates(result, best) < 0) best = result;
      return result;
    } catch (error) {
      // A WASM fault invalidates the engine for this worker, not the saved model.
      if (/aborted|memory access|BindingError/i.test(String(error))) aborted = true;
      options.onPositionError?.(error, { projection: base.projection, seed, changes, kind });
    }
  };
  route(best, best.layout, [], 'reroute');
  for (let round = 0; round < 4 && !aborted && performance.now() - started < budget; round++) {
    const base = best;
    const moves = positionCandidates(base.projection, base.layout, base.projection.nodes.length > 30 ? 24 : 64);
    for (const move of moves) {
      if (aborted || performance.now() - started >= budget) break;
      const seed = structuredClone(base.layout), movedIds = new Set();
      for (const m of move.moves || [move]) {
        const node = seed.children.find(n => n.id === m.nodeId);
        node.x = m.x; node.y = m.y; movedIds.add(m.nodeId);
      }
      seed.children = settleJunctions(base.projection, seed.children);
      if (!seed.children) continue;
      route(base, seed, [], move.kind);
      if (aborted) break;
      const movedPorts = new Set(base.projection.nodes.filter(n => movedIds.has(n.id)).flatMap(n => n.ports.map(p => p.id)));
      const incident = base.projection.edges.filter(e => [...e.sources, ...e.targets].some(id => movedPorts.has(id)));
      const affected = new Set(incident.flatMap(e => [...e.sources, ...e.targets]));
      const exclusive = new Set([...affected].filter(id => base.projection.edges.filter(e => [...e.sources, ...e.targets].includes(id)).length === 1));
      const changes = portSuggestions(base.projection, seed, Infinity).filter(c => exclusive.has(c.id));
      if (changes.length) route(base, seed, changes, move.kind + ' / ports');
      if (aborted) break;
      if (move.kind === 'leaf-above' || move.kind === 'leaf-below') {
        for (const side of ['EAST', 'WEST']) {
          route(base, seed, [...exclusive].map(id => ({ id, side })), move.kind + ' / ' + side);
          if (aborted) break;
        }
      }
    }
    if (best === base) break;
    results.push(best);
  }
  if (!results.includes(best)) results.push(best);
  return results.sort(compareCandidates);
}
