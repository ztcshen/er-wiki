const { test } = require('node:test');
const assert = require('node:assert/strict');

test('the baseline producer runs annotation placement before publishing and keeps original model records', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const { candidateValidity } = await import('../eda/layout-quality.mjs');
  const model = { tables: [
    { id: 'a', name: 'accounts', fields: [{ id: 'id', name: 'id', type: 'BIGINT', primary: true }] },
    { id: 'b', name: 'entries', fields: [{ id: 'fk', name: 'account_id', type: 'BIGINT' }] },
  ], relationships: [{ id: 'r', startTableId: 'b', startFieldId: 'fk', endTableId: 'a', endFieldId: 'id', cardinality: 'many_to_one' }], groups: [] };
  const before = structuredClone(model), published = [];
  const result = await arrangeSchematic(model, { optimize: false, labels: 'off', onCandidate: value => published.push(value) });
  assert(published.length > 0);
  assert(result.layout.annotationPlacement);
  for (const candidate of published) {
    assert(candidate.layout.annotationPlacement, 'A published baseline includes its completed annotation stage');
    assert(candidateValidity(candidate).valid);
  }
  assert.deepEqual(model, before);
});

test('fitting the complete result includes persisted badge geometry without moving tables', async () => {
  const { cardinalityBadges } = await import('../eda/cardinality.mjs');
  const { layoutViewBox } = await import('../eda/camera.mjs');
  const projection = { nodes: [{ id: 'a', kind: 'table', tableId: 'a', ports: [{ id: 'out', x: 100, y: 30, layoutOptions: { 'elk.port.side': 'EAST' } }] }],
    edges: [{ id: 'edge', kind: 'bus', sources: ['out'], targets: [], refs: ['r'], netIds: ['net'] }],
    nets: [{ members: [{ id: 'r', cardinality: 'many_to_one' }] }], domains: [] };
  const result = { projection, layout: { width: 600, height: 300, children: [{ id: 'a', x: 100, y: 100, width: 100, height: 60 }],
    edges: [{ id: 'edge', sections: [{ startPoint: { x: 200, y: 130 }, endPoint: { x: 260, y: 130 } }] }] } };
  const badge = cardinalityBadges(result)[0];
  result.layout.annotationPositions = { cardinality: [{ id: badge.id, x: 300, y: 130 }], bundles: [{ id: 'edge', x: 550, y: 200 }] };
  const before = structuredClone(result), box = layoutViewBox(result, 0);
  assert(box[0] <= 100 && box[1] <= 100);
  assert(box[0] + box[2] >= 582 && box[1] + box[3] >= 208,
    'Fitted extent contains the saved bus-count rectangle, not only the route');
  assert.deepEqual(result, before);
});

test('rerouting drops obsolete badge positions and retains blocked labels for annotation repair', async () => {
  const { loadObstacleRouter, routeObstacles } = await import('../eda/obstacle-router.mjs');
  const { layoutQuality } = await import('../eda/layout-quality.mjs');
  const { scoreLayout, validateLayout } = await import('../eda/metrics.mjs');
  const projection = {
    nodes: [
      { id: 'a', kind: 'table', tableId: 'a', width: 100, height: 60, ports: [{ id: 'a-out', x: 100, y: 30, layoutOptions: { 'elk.port.side': 'EAST' } }] },
      { id: 'b', kind: 'table', tableId: 'b', width: 100, height: 60, ports: [{ id: 'b-in', x: 0, y: 30, layoutOptions: { 'elk.port.side': 'WEST' } }] },
    ],
    edges: [{ id: 'r', kind: 'conditional', sources: ['a-out'], targets: ['b-in'], refs: ['r'], netIds: ['net'], labels: [{ id: 'condition', text: 'Unusually wide condition', width: 1000, height: 40 }] }],
    nets: [{ members: [{ id: 'r', startTableId: 'b', endTableId: 'a', cardinality: 'many_to_one' }] }],
    domains: [],
  };
  const seed = { width: 440, height: 140,
    children: projection.nodes.map((n, i) => ({ ...structuredClone(n), x: 40 + i * 260, y: 40 })), edges: [],
    annotationPositions: { cardinality: [{ id: 'obsolete', x: 9999, y: 9999 }], bundles: [] },
    annotationPlacement: { status: 'stale' },
  };
  const before = structuredClone(seed);
  const layout = routeObstacles(await loadObstacleRouter(), projection, seed);
  validateLayout(layout, projection);
  assert.equal(layout.annotationPositions, undefined);
  assert.equal(layout.annotationPlacement, undefined);
  const label = layout.edges[0].labels[0];
  assert([label.x, label.y, label.width, label.height].every(Number.isFinite));
  assert.equal(label.text, 'Unusually wide condition');
  assert(layoutQuality(layout, projection, scoreLayout(layout, projection)).labelOverlaps > 0,
    'The unresolved obstruction must remain visible to validity scoring');
  assert.deepEqual(seed, before, 'Routing and stale annotation removal must not mutate the prior candidate');
});
