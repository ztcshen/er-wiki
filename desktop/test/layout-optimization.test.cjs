const { test } = require('node:test');
const assert = require('node:assert/strict');

test('candidate graph owns mutable ports and labels', async () => {
  const { elkGraph } = await import('../eda/elk-graph.mjs');
  const p = { nodes: [{ id: 'a', width: 100, height: 100, ports: [{ id: 'p', x: 0 }] }], edges: [{ id: 'e', sources: ['p'], targets: ['p'], labels: [{ text: 'condition', x: 99, y: 80 }] }] };
  const before = JSON.stringify(p), graph = elkGraph(p, {});
  graph.children[0].ports[0].x = 400;
  graph.edges[0].labels[0].text = 'changed';
  assert.equal(JSON.stringify(p), before);
  assert.equal(graph.edges[0].labels[0].x, undefined);
});

test('moving a port preserves semantic identities and input', async () => {
  const { movePorts } = await import('../eda/optimize-layout.mjs');
  const p = { nodes: [{ width: 360, ports: [{ id: 'field-port', x: 0, y: 42, fieldId: 'f', layoutOptions: { 'elk.port.side': 'WEST' } }] }], edges: [{ refs: ['r'], sources: ['field-port'], targets: ['other'] }] };
  const before = JSON.stringify(p), moved = movePorts(p, [{ id: 'field-port', side: 'EAST' }]);
  assert.equal(moved.nodes[0].ports[0].x, 360);
  assert.equal(moved.nodes[0].ports[0].y, 42);
  assert.deepEqual(moved.edges, p.edges);
  assert.equal(JSON.stringify(p), before);
});

test('quality detects obstructed routes and ignores disconnected groups', async () => {
  const { layoutQuality, cohesiveGroups } = await import('../eda/layout-quality.mjs');
  const p = { nodes: [], edges: [{ id: 'e', refs: ['r'], sources: [], targets: [] }], nets: [], domains: [{ id: 'infra', tableIds: ['a', 'b'] }] };
  assert.deepEqual(cohesiveGroups(p), []);
  const q = layoutQuality({ width: 100, height: 100, children: [{ x: 40, y: 40, width: 20, height: 20 }], edges: [{ id: 'e', sections: [{ startPoint: { x: 0, y: 50 }, endPoint: { x: 100, y: 50 } }], labels: [{ x: 45, y: 45, width: 10, height: 10 }] }] }, p, { length: 100 });
  assert.equal(q.nodeIntrusions, 1);
  assert.equal(q.labelOverlaps, 1);
});

test('optimization retains baseline, relationships and placement without mutating model', async () => {
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const { compareCandidates } = await import('../eda/layout-quality.mjs');
  const { placementHints, satisfiesPlacement } = await import('../eda/placement.mjs');
  const m = conditionalModel();
  m.tables.find(t => t.id === 'notifications').reviewPlacement = { belowTableId: 'credit_applications', gap: 150 };
  const before = JSON.stringify(m), result = await arrangeSchematic(m, { labels: 'off', bundle: true });
  assert.equal(JSON.stringify(m), before);
  assert.equal(result.metrics.overlaps, 0);
  assert(satisfiesPlacement(result.layout, placementHints(result.projection)));
  assert.deepEqual(new Set(result.projection.covered), new Set(m.relationships.map(r => r.id)));
  assert(result.candidates.some(c => !c.optimization));
  for (const c of result.candidates) assert(compareCandidates(result, c) <= 0);
});
