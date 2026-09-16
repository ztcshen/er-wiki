const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = () => ({ layout: { width: 100, height: 100, children: [], edges: [
  { id: 'a', sections: [{ startPoint: { x: 0, y: 10 }, endPoint: { x: 100, y: 10 } }], labels: [{ x: 40, y: 5, width: 20, height: 10 }] },
  { id: 'b', sections: [{ startPoint: { x: 50, y: 0 }, endPoint: { x: 50, y: 100 } }] },
] }, projection: { nodes: [], domains: [], nets: [], edges: [
  { id: 'a', sources: [], targets: [], refs: ['a'], netIds: ['a'] },
  { id: 'b', sources: [], targets: [], refs: ['b'], netIds: ['b'] },
] } });
test('a wire through another relationship label invalidates the candidate', async () => {
  const { scoreLayout } = await import('../eda/metrics.mjs');
  const { layoutQuality, candidateValidity, compareCandidates } = await import('../eda/layout-quality.mjs');
  const bad = fixture(); bad.metrics = scoreLayout(bad.layout, bad.projection); bad.quality = layoutQuality(bad.layout, bad.projection, bad.metrics);
  assert.equal(bad.quality.annotationIntrusions, 1);
  assert.equal(candidateValidity(bad).valid, false);
  const good = fixture(); good.layout.edges[0].labels = [];
  good.metrics = scoreLayout(good.layout, good.projection); good.quality = layoutQuality(good.layout, good.projection, good.metrics);
  assert.equal(candidateValidity(good).valid, true);
  bad.metrics.crossings = 0;
  assert(compareCandidates(good, bad) < 0, 'readable crossing wins over zero-crossing obstruction');
});
test('missing diagnostics and foreign node identities cannot be declared valid', async () => {
  const { candidateValidity } = await import('../eda/layout-quality.mjs');
  assert.equal(candidateValidity(fixture()).valid, false);
  const { validateLayout } = await import('../eda/metrics.mjs');
  assert.throws(() => validateLayout({ children: [{ id: 'wrong', x: 0, y: 0, width: 1, height: 1 }], edges: [] }, { nodes: [{ id: 'expected' }], edges: [] }));
  const value = fixture(); value.projection.edges[0].sources = ['expected-port'];
  assert.throws(() => validateLayout(value.layout, value.projection), /端点/);
});

test('a degraded result remains available for inspection but is not cached', async () => {
  const { createCachedLayoutTask } = await import('../eda/cached-layout-task.mjs');
  const { scoreLayout } = await import('../eda/metrics.mjs');
  const { layoutQuality } = await import('../eda/layout-quality.mjs');
  const value = fixture(); value.status = 'degraded';
  value.metrics = scoreLayout(value.layout, value.projection);
  value.quality = layoutQuality(value.layout, value.projection, value.metrics);
  let writes = 0;
  const task = createCachedLayoutTask({ modelId: 'example', scope: 'overview', shape: 'shape',
    cache: { get: async () => null, put: async () => { writes++; } }, computeDelayMs: 0,
    compute: () => ({ promise: Promise.resolve(value), cancel() {} }) });
  const result = await task.promise;
  assert.equal(result.status, 'degraded'); assert.equal(writes, 0);
  assert.equal(result.quality.annotationIntrusions, 1);
});

test('bundle count boxes participate in obstruction checks', async () => {
  const { scoreLayout } = await import('../eda/metrics.mjs');
  const { layoutQuality } = await import('../eda/layout-quality.mjs');
  const value = fixture(); value.layout.edges[0].labels = [];
  value.projection.edges[0].kind = 'bus';
  value.layout.children = [{ id: 'box', x: 40, y: -5, width: 20, height: 5 }];
  value.projection.nodes = [{ id: 'box', kind: 'table', tableId: 'box', ports: [] }];
  const quality = layoutQuality(value.layout, value.projection, scoreLayout(value.layout, value.projection));
  assert.equal(quality.badgeOverlaps, 0, 'A movable badge avoids the small obstruction');
  Object.assign(value.layout.children[0], {x:-100,y:-100,width:400,height:300});
  const blocked = layoutQuality(value.layout, value.projection, scoreLayout(value.layout, value.projection));
  assert(blocked.badgeOverlaps > 0, 'No free position must still report obstruction');
});

test('all unreadable baseline candidates yield explicit degraded diagnostics without deleting tables', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const model = { tables: ['a', 'b'].map(id => ({ id, name: id, fields: [{ id: 'id', name: 'id' }] })), relationships: [], groups: [] };
  const before = JSON.stringify(model);
  const engine = { layout: async graph => ({ ...graph, width: 400, height: 200, children: graph.children.map(node => ({ ...node, x: 0, y: 0 })) }) };
  const result = await arrangeSchematic(model, { optimize: false, labels: 'off' }, engine);
  assert.equal(result.status, 'degraded');
  assert(result.validity.reasons.includes('overlaps'));
  assert.equal(result.projection.nodes.length, 2);
  assert.equal(JSON.stringify(model), before);
});
