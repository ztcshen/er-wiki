const { test } = require('node:test');
const assert = require('node:assert/strict');

test('topology detects leaves despite duplicate references and self relations', async () => {
  const { tableNeighbors, positionCandidates } = await import('../eda/position-candidates.mjs');
  const nodes = ['a', 'b'].map(id => ({ id, tableId: id, kind: 'table', ports: [] }));
  const projection = { level: 'overview', nodes, domains: [], nets: [{ members: [
    { startTableId: 'a', endTableId: 'b' }, { startTableId: 'a', endTableId: 'b' }, { startTableId: 'a', endTableId: 'a' },
  ] }] };
  assert.equal(tableNeighbors(projection).get('a').size, 1);
  const layout = { children: [{ id: 'a', x: 40, y: 100, width: 200, height: 120 }, { id: 'b', x: 900, y: 100, width: 200, height: 120 }] };
  const before = JSON.stringify(layout), candidates = positionCandidates(projection, layout);
  assert(candidates.some(c => c.nodeId === 'b' && c.kind === 'leaf-above' && c.x === 40));
  assert(candidates.some(c => c.nodeId === 'b' && c.kind === 'leaf-below' && c.x === 40));
  assert.equal(JSON.stringify(layout), before);
});

test('virtual junction yields an occupied slot without moving real tables', async () => {
  const { settleJunctions } = await import('../eda/position-candidates.mjs');
  const projection = { nodes: [{ id: 'table', kind: 'table' }, { id: 'hub', kind: 'hub' }] };
  const children = [{ id: 'table', x: 100, y: 100, width: 360, height: 200 }, { id: 'hub', x: 150, y: 160, width: 80, height: 50 }];
  const result = settleJunctions(projection, children);
  assert.deepEqual(result[0], children[0]);
  assert.notDeepEqual(result[1], children[1]);
  assert.equal(children[1].x, 150);
});

test('obstacle routes retain exact field pins, labels and all identities', async () => {
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const { loadObstacleRouter, routeObstacles } = await import('../eda/obstacle-router.mjs');
  const { validateLayout } = await import('../eda/metrics.mjs');
  const baseline = await arrangeSchematic(conditionalModel(), { labels: 'off', refinePositions: false });
  const before = JSON.stringify(baseline), A = await loadObstacleRouter();
  for (let run = 0; run < 3; run++) {
    const layout = routeObstacles(A, baseline.projection, baseline.layout);
    validateLayout(layout, baseline.projection);
    const ports = new Map(layout.children.flatMap(n => n.ports.map(p => [p.id, { x: n.x + p.x, y: n.y + p.y }])));
    for (const e of layout.edges) {
      assert.deepEqual(e.sections[0].startPoint, ports.get(e.sources[0]));
      assert.deepEqual(e.sections[0].endPoint, ports.get(e.targets[0]));
    }
  }
  assert.equal(JSON.stringify(baseline), before);
});

test('optional position search preserves baseline, semantics and quality order', async () => {
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const { refinePositions } = await import('../eda/refine-positions.mjs');
  const { compareCandidates } = await import('../eda/layout-quality.mjs');
  const baseline = await arrangeSchematic(conditionalModel(), { labels: 'off', refinePositions: false });
  const before = JSON.stringify(baseline);
  const results = await refinePositions([baseline], { onPositionError: e => { if (/aborted|memory|BindingError/i.test(String(e))) throw e; } });
  assert(results.includes(baseline));
  assert(compareCandidates(results[0], baseline) <= 0);
  assert.deepEqual(results[0].projection.covered, baseline.projection.covered);
  assert.equal(JSON.stringify(baseline), before);
  assert.deepEqual(await refinePositions([baseline], { refinePositions: false }), [baseline]);
});
