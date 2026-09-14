import { placementHints, placementPositions, satisfiesPlacement } from './placement.mjs';
import { settleJunctions } from './position-candidates.mjs';
import { rectanglesOverlap } from './obstacle-router.mjs';

// ShrinkTree (ELK SPOrE) proposes topology-preserving compaction, not routes.
// Never reuse its old edge geometry: every accepted seed is routed by libavoid.
export async function compactLayoutSeeds(projection, layout, elk) {
  if (!elk || projection.nodes.length > 80 || layout.children.length < 2) return [];
  const seeds = [], hints = placementHints(projection);
  for (const orthogonal of [true, false]) for (const gap of [80, 120]) {
    try {
      const compact = await elk.layout({ id: 'compaction', layoutOptions: {
        'elk.algorithm': 'org.eclipse.elk.sporeCompaction',
        'elk.compaction.orthogonal': String(orthogonal), 'elk.spacing.nodeNode': String(gap),
        'elk.padding': '[top=40,left=40,bottom=40,right=40]',
      }, children: layout.children.map(n => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height })), edges: [] });
      if (compact.children.length !== layout.children.length) continue;
      const positions = placementPositions(compact, hints), seed = structuredClone(layout);
      seed.children = seed.children.map(n => ({ ...n, ...positions.get(n.id) }));
      seed.children = settleJunctions(projection, seed.children);
      if (!seed.children || !satisfiesPlacement(seed, hints)) continue;
      if (seed.children.some((n, i) => ![n.x, n.y].every(Number.isFinite) || seed.children.slice(0, i).some(other => rectanglesOverlap(n, other, 40)))) continue;
      seeds.push({ layout: seed, kind: `spore / ${orthogonal ? 'orthogonal' : 'free'} / ${gap}` });
    } catch { /* An infeasible compaction does not replace a valid layout. */ }
  }
  return seeds;
}
