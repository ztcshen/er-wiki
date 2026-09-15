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
});
