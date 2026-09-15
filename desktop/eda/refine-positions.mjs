import { loadObstacleRouter, routeObstacles } from './obstacle-router.mjs';
import { positionCandidates, settleJunctions } from './position-candidates.mjs';
import { portSuggestions, movePorts } from './optimize-layout.mjs';
import { scoreLayout, validateLayout } from './metrics.mjs';
import { layoutQuality, compareCandidates, candidateValidity } from './layout-quality.mjs';
import { fourSideSuggestions } from './ports.mjs';
import { compactLayoutSeeds } from './compact-layout.mjs';

export async function refinePositions(candidates, options = {}, elk) {
  let best = [...candidates].sort(compareCandidates)[0];
  // Global synchronous WASM rerouting cannot be interrupted by a soft deadline.
  // Larger projections already receive bounded, local ELK port candidates above.
  if (options.refinePositions === false || best.projection.nodes.length > 80 || options.budget?.expired()) return candidates;
  const results = [...candidates];
  let Avoid, aborted = false;
  try { Avoid = await loadObstacleRouter(); } catch { return results; }
  const now = options.budget?.now || (() => performance.now());
  const started = now(), budget = Math.min(options.positionBudgetMs ?? 6000, options.budget?.remaining() ?? 6000);
  const route = (base, seed, changes, kind) => {
    if (aborted || now() - started >= budget || options.budget?.expired()) return;
    try {
      const projection = movePorts(base.projection, changes);
      const layout = routeObstacles(Avoid, projection, seed);
      validateLayout(layout, projection);
      const metrics = scoreLayout(layout, projection), quality = layoutQuality(layout, projection, metrics, options.targetAspectRatio);
      if (!candidateValidity({ projection, layout, metrics, quality }).valid) return;
      const result = { ...base, projection, layout, metrics, quality, optimization: `position / ${kind}` };
      if (compareCandidates(result, best) < 0) best = result;
      options.onCandidate?.(result);
      return result;
    } catch (error) {
      // A WASM fault invalidates the engine for this worker, not the saved model.
      if (/aborted|memory access|BindingError/i.test(String(error))) aborted = true;
      options.onPositionError?.(error, { projection: base.projection, seed, changes, kind });
    }
  };
  const trySides = (base, seed, kind) => {
    if (aborted) return;
    const suggestions = fourSideSuggestions(base.projection, seed);
    // Try whole assignment and each affected edge independently, so a bad side
    // on one relation cannot hide a useful top/bottom choice on another.
    const variants = [suggestions, ...base.projection.edges.map(e => suggestions.filter(s => [...e.sources, ...e.targets].includes(s.id)))];
    const seen = new Set();
    for (const changes of variants) {
      if (aborted || now() - started >= budget) break;
      const key = JSON.stringify(changes);
      if (!changes.length || seen.has(key)) continue;
      seen.add(key); route(base, seed, changes, kind + ' / four-sides');
    }
  };
  route(best, best.layout, [], 'reroute');
  trySides(best, best.layout, 'ports');
  const compact = async () => {
    const base = best;
    if (now() - started >= budget) return;
    const localBudget = { expired: () => now() - started >= budget || !!options.budget?.expired() };
    for (const seed of await compactLayoutSeeds(base.projection, base.layout, elk, { ...options, budget: localBudget })) {
      if (aborted || now() - started >= budget) break;
      route(base, seed.layout, [], seed.kind);
      trySides(base, seed.layout, seed.kind);
    }
  };
  await compact();
  for (let round = 0; round < 4 && !aborted && now() - started < budget; round++) {
    const base = best;
    const moves = positionCandidates(base.projection, base.layout, base.projection.nodes.length > 30 ? 24 : 64);
    for (const move of moves) {
      if (aborted || now() - started >= budget) break;
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
      if (!aborted) {
        const four = fourSideSuggestions(base.projection, seed).filter(c => exclusive.has(c.id));
        if (four.length) route(base, seed, four, move.kind + ' / four-sides');
      }
    }
    if (best === base) break;
    results.push(best);
  }
  if (!aborted && now() - started < budget) await compact();
  if (!results.includes(best)) results.push(best);
  return results.sort(compareCandidates);
}
