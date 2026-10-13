const { test } = require('node:test');
const assert = require('node:assert/strict');

function fixture() {
  const node = { id: 'table', kind: 'table', tableId: 'table', x: 30, y: 80, width: 80, height: 80,
    ports: [{ id: 'pin', x: 80, y: 40, layoutOptions: { 'elk.port.side': 'EAST' } }] };
  return { projection: { nodes: [node], domains: [], nets: [{ members: [{ id: 'r', cardinality: 'many_to_one' }] }],
    edges: [{ id: 'a', kind: 'conditional', sources: ['pin'], targets: [], refs: ['r'], netIds: ['r'] },
      { id: 'b', sources: [], targets: [], refs: ['other'], netIds: ['other'] }] },
  layout: { width: 500, height: 260, children: [structuredClone(node)], edges: [
    { id: 'a', sources: ['pin'], targets: [], sections: [{ startPoint: { x: 110, y: 120 }, endPoint: { x: 470, y: 120 } }],
      labels: [{ id: 'label', x: 180, y: 98, width: 100, height: 22, text: 'kind = delivery' }] },
    { id: 'b', sources: [], targets: [], sections: [{ startPoint: { x: 230, y: 20 }, endPoint: { x: 230, y: 240 } }] },
  ] } };
}
const quality = async (layout, projection) => {
  const { layoutQuality } = await import('../eda/layout-quality.mjs');
  const { scoreLayout } = await import('../eda/metrics.mjs');
  return layoutQuality(layout, projection, scoreLayout(layout, projection));
};

test('independent annotation pass repairs a foreign wire collision without moving tables or routes', async () => {
  const { optimizeAnnotations } = await import('../eda/annotation-layout.mjs');
  const { layout, projection } = fixture(), before = structuredClone(layout);
  assert.equal((await quality(layout, projection)).annotationIntrusions, 1);
  const next = optimizeAnnotations(layout, projection, { annotationBudgetMs: 1000 });
  assert.equal((await quality(next, projection)).annotationIntrusions, 0);
  assert.deepEqual(layout, before, 'Input candidate remains available for rollback');
  assert.deepEqual(next.children, layout.children);
  assert.deepEqual(next.edges.map(e => e.sections), layout.edges.map(e => e.sections));
  assert.equal(next.edges[0].labels[0].text, layout.edges[0].labels[0].text);
  assert(next.annotationPlacement.acceptedGroups > 0);
  assert.deepEqual(optimizeAnnotations(layout, projection, { annotationBudgetMs: 1000 }).annotationPositions, next.annotationPositions);
});

test('related text labels move as one group and selected scope leaves other relationships unchanged', async () => {
  const { optimizeAnnotations } = await import('../eda/annotation-layout.mjs');
  const { layout, projection } = fixture();
  layout.edges[0].labels.push({ id: 'detail', x: 180, y: 72, width: 100, height: 22, text: 'related caption' });
  layout.edges[1].labels = [{ id: 'outside-scope', x: 220, y: 110, width: 40, height: 20 }];
  const next = optimizeAnnotations(layout, projection, { annotationBudgetMs: 1000, annotationRelations: ['r'] });
  const delta = next.edges[0].labels.map((l, i) => [l.x - layout.edges[0].labels[i].x, l.y - layout.edges[0].labels[i].y]);
  assert.notDeepEqual(delta[0], [0, 0]); assert.deepEqual(delta[0], delta[1]);
  assert.deepEqual(next.edges[1].labels, layout.edges[1].labels);
});

test('cardinality repairs stay on the owning field normal and preserve values under focus', async () => {
  const { optimizeAnnotations } = await import('../eda/annotation-layout.mjs');
  const { cardinalityBadges } = await import('../eda/cardinality.mjs');
  const { layout, projection } = fixture();
  layout.edges[0].labels = [];
  layout.edges[1].sections[0] = { startPoint: { x: 129, y: 10 }, endPoint: { x: 129, y: 250 } };
  const initial = cardinalityBadges({ layout, projection })[0];
  const next = optimizeAnnotations(layout, projection, { annotationBudgetMs: 1000 });
  const badge = cardinalityBadges({ layout: next, projection }, 'r')[0];
  assert.equal(badge.y, initial.y); assert(badge.x > initial.x && badge.x <= initial.x + 48);
  assert.equal(badge.value, initial.value); assert.deepEqual(badge.refs, initial.refs);
  assert.equal((await quality(next, projection)).annotationIntrusions, 0);
});

test('unrepairable scenes, disabled stages and expired budgets preserve original geometry', async () => {
  const { optimizeAnnotations } = await import('../eda/annotation-layout.mjs');
  const { layout, projection } = fixture();
  assert.equal(optimizeAnnotations(layout, projection, { annotations: false }), layout);
  assert.equal(optimizeAnnotations(layout, projection, { budget: { expired: () => true } }), layout);
  const barrier = { id: 'barrier', x: 112, y: 0, width: 388, height: 260, kind: 'table', ports: [] };
  layout.edges[1].sections[0] = { startPoint: { x: 495, y: 10 }, endPoint: { x: 495, y: 250 } };
  layout.children.push(barrier); projection.nodes.push(barrier);
  const before = await quality(layout, projection);
  const next = optimizeAnnotations(layout, projection, { annotationBudgetMs: 1000 });
  assert.deepEqual(next.edges[0].labels, layout.edges[0].labels, 'No clearance means keep original, not hide label');
  const after = await quality(next, projection);
  for (const key of ['labelOverlaps', 'badgeOverlaps', 'annotationIntrusions']) assert(after[key] <= before[key]);
});

test('bounded search exposes exhaustion and keeps a complete, usable candidate', async () => {
  const { optimizeAnnotations } = await import('../eda/annotation-layout.mjs');
  const { layout, projection } = fixture();
  const next = optimizeAnnotations(layout, projection, { annotationBudgetMs: 1000, annotationMaxEvaluations: 1 });
  assert.equal(next.annotationPlacement.stopReason, 'limit');
  assert(next.annotationPlacement.evaluated <= 1);
  assert.deepEqual(next.children, layout.children);
  assert.equal(next.edges[0].labels.length, 1);
});

test('offset saved views optimize in their actual world bounds without relocating tables', async () => {
  const { optimizeAnnotations } = await import('../eda/annotation-layout.mjs');
  for (const offset of [-500, 10000]) {
    const { layout, projection } = fixture();
    for (const node of layout.children) { node.x += offset; node.y += offset; }
    for (const edge of layout.edges) {
      for (const s of edge.sections) for (const p of [s.startPoint, ...(s.bendPoints || []), s.endPoint]) { p.x += offset; p.y += offset; }
      for (const label of edge.labels || []) { label.x += offset; label.y += offset; }
    }
    layout.bounds = { x: offset, y: offset, width: layout.width, height: layout.height };
    const next = optimizeAnnotations(layout, projection, { annotationBudgetMs: 1000 });
    assert.equal((await quality(next, projection)).annotationIntrusions, 0);
    assert.deepEqual(next.children, layout.children); assert.deepEqual(next.bounds, layout.bounds);
  }
});
