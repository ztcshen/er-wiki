const { test } = require('node:test');
const assert = require('node:assert/strict');

async function fixture() {
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const { projectModel } = await import('../eda/model.mjs');
  const { cardinalityBadges, bundleBadges } = await import('../eda/cardinality.mjs');
  const { scoreLayout } = await import('../eda/metrics.mjs');
  const model = conditionalModel(), options = { level: 'overview', labels: 'off' };
  const projection = projectModel(model, options);
  const children = projection.nodes.map((node, i) => ({ ...structuredClone(node), x: 100 + i * 500, y: 100 + i % 2 * 320 }));
  const ports = new Map(children.flatMap(node => node.ports.map(port => [port.id, { x: node.x + port.x, y: node.y + port.y }])));
  const edges = projection.edges.map((edge, i) => {
    const startPoint = ports.get(edge.sources[0]), endPoint = ports.get(edge.targets[0]), x = (startPoint.x + endPoint.x) / 2;
    return { ...edge, sections: [{ startPoint, bendPoints: [{ x, y: startPoint.y }, { x, y: endPoint.y }], endPoint }],
      ...(edge.labels ? { labels: edge.labels.map(label => ({ ...label, x: 150 + i * 220, y: 50 })) } : {}) };
  });
  const layout = { width: 3500, height: 1000, children, edges };
  const result = { projection, layout, longCuts: [], candidates: [], metrics: scoreLayout(layout, projection) };
  const position = ({ id, x, y }) => ({ id, x, y });
  layout.annotationPositions = { cardinality: cardinalityBadges(result).map(position), bundles: bundleBadges(result).map(position) };
  return { model, options, result, cardinalityBadges, bundleBadges };
}

test('annotation snapshots keep final geometry while restoring current semantics', async () => {
  const { layoutSnapshot, restoreLayoutSnapshot } = await import('../eda/layout-snapshot.mjs');
  const { model, options, result, cardinalityBadges, bundleBadges } = await fixture();
  const badge = result.layout.annotationPositions.cardinality[0];
  badge.x += 16;
  badge.value = 'STALE-VALUE'; badge.refs = ['STALE-RELATION'];
  result.layout.annotationPositions.bundles[0].count = 999;
  result.layout.annotationPlacement = { currentStage: 'ephemeral' };
  const snapshot = layoutSnapshot(result);
  assert.deepEqual(snapshot.layout.annotationPositions.cardinality[0], { id: badge.id, x: badge.x, y: badge.y });
  assert(!JSON.stringify(snapshot).includes('STALE-'));
  assert.equal(snapshot.layout.annotationPlacement, undefined);
  snapshot.layout.annotationPositions.bundles[0].count = 999;
  model.relationships.find(r => r.id === 'loan-credit').cardinality = 'one_to_one';
  const restored = restoreLayoutSnapshot(snapshot, model, options);
  delete snapshot.layout.annotationPositions.bundles[0].count;
  assert.deepEqual(restored.layout.annotationPositions, snapshot.layout.annotationPositions);
  assert.equal(cardinalityBadges(restored).find(b => b.id === badge.id).x, badge.x);
  assert.equal(cardinalityBadges(restored).find(b => b.tableId === 'loans' && b.side === 'WEST').value, '1');
  assert.equal(bundleBadges(restored)[0].count, 2);
  assert.deepEqual(restored.layout.edges.flatMap(e => e.labels || []).map(l => l.text), result.layout.edges.flatMap(e => e.labels || []).map(l => l.text));
});

test('snapshots without annotation positions retain the canonical fallback', async () => {
  const { layoutSnapshot, restoreLayoutSnapshot } = await import('../eda/layout-snapshot.mjs');
  const { model, options, result, cardinalityBadges } = await fixture();
  delete result.layout.annotationPositions;
  const restored = restoreLayoutSnapshot(layoutSnapshot(result), model, options);
  assert.equal(restored.layout.annotationPositions, undefined);
  assert.deepEqual(cardinalityBadges(restored), cardinalityBadges(result));
});

test('cached annotation identity and bounded coordinates are checked before display', async () => {
  const { layoutSnapshot, restoreLayoutSnapshot } = await import('../eda/layout-snapshot.mjs');
  const { model, options, result } = await fixture();
  const snapshot = layoutSnapshot(result);
  const mutations = [
    p => { p.cardinality[0].id = 'unknown'; },
    p => { p.cardinality[1].id = p.cardinality[0].id; },
    p => { p.cardinality.pop(); },
    p => { p.bundles.push({ ...p.bundles[0] }); },
    p => { p.bundles[0].id = 'wire-not-in-model'; },
    p => { p.cardinality[0].x = NaN; },
    p => { p.bundles[0].y = Infinity; },
    p => { p.cardinality[0].x = 1e9; },
    p => { p.bundles = {}; },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(snapshot); mutate(bad.layout.annotationPositions);
    assert.throws(() => restoreLayoutSnapshot(bad, model, options), /cached annotation/i);
  }
});

test('cached cardinality stays on its field normal and inside its permitted outward range', async () => {
  const { layoutSnapshot, restoreLayoutSnapshot } = await import('../eda/layout-snapshot.mjs');
  const { model, options, result } = await fixture();
  const snapshot = layoutSnapshot(result);
  for (const [dx, dy] of [[0, 1], [-8, 0], [49, 0]]) {
    const bad = structuredClone(snapshot), badge = bad.layout.annotationPositions.cardinality[0];
    badge.x += dx; badge.y += dy;
    assert.throws(() => restoreLayoutSnapshot(bad, model, options), /cached annotation/i);
  }
  const good = structuredClone(snapshot); good.layout.annotationPositions.cardinality[0].x += 48;
  assert.doesNotThrow(() => restoreLayoutSnapshot(good, model, options));
  const outside = structuredClone(good); outside.layout.width = good.layout.annotationPositions.cardinality[0].x;
  assert.throws(() => restoreLayoutSnapshot(outside, model, options), /Cached annotation outside layout/);
});

test('cached bundle movement must remain near its own route and within the canvas', async () => {
  const { layoutSnapshot, restoreLayoutSnapshot } = await import('../eda/layout-snapshot.mjs');
  const { model, options, result } = await fixture();
  const snapshot = layoutSnapshot(result), edge = result.layout.edges.find(e => e.id === snapshot.layout.annotationPositions.bundles[0].id);
  const section = edge.sections[0], x = (section.startPoint.x + section.bendPoints[0].x) / 2;
  const good = structuredClone(snapshot); Object.assign(good.layout.annotationPositions.bundles[0], { x, y: section.startPoint.y - 46 });
  assert.doesNotThrow(() => restoreLayoutSnapshot(good, model, options));
  for (const point of [{ x, y: 950 }, { x: -20, y: section.startPoint.y }, { x: 3490, y: section.startPoint.y }]) {
    const bad = structuredClone(snapshot); Object.assign(bad.layout.annotationPositions.bundles[0], point);
    assert.throws(() => restoreLayoutSnapshot(bad, model, options), /cached annotation/i);
  }
});

test('annotation cache retains shifted canvas bounds, including negative coordinates', async () => {
  const { layoutSnapshot, restoreLayoutSnapshot } = await import('../eda/layout-snapshot.mjs');
  const { model, options, result } = await fixture();
  const dx = 10000, dy = -500;
  const shifted = new Set();
  const shift = point => { if (!shifted.has(point)) { point.x += dx; point.y += dy; shifted.add(point); } };
  result.layout.children.forEach(shift);
  for (const edge of result.layout.edges) {
    for (const section of edge.sections) [section.startPoint, ...section.bendPoints, section.endPoint].forEach(shift);
    (edge.labels || []).forEach(shift);
  }
  Object.values(result.layout.annotationPositions).flat().forEach(shift);
  result.layout.bounds = { x: dx, y: dy, width: result.layout.width, height: result.layout.height };
  result.layout.annotationPositions.cardinality[0].x += 16;
  const snapshot = layoutSnapshot(result);
  assert.deepEqual(snapshot.layout.bounds, result.layout.bounds);
  const restored = restoreLayoutSnapshot(snapshot, model, options);
  assert.deepEqual(restored.layout.bounds, result.layout.bounds);
  assert.deepEqual(restored.layout.annotationPositions, result.layout.annotationPositions);
  for (const mutate of [bounds => { bounds.x = NaN; }, bounds => { bounds.y = -1e9; },
    bounds => { bounds.width++; }, bounds => { bounds.height = 0; }]) {
    const bad = structuredClone(snapshot); mutate(bad.layout.bounds);
    assert.throws(() => restoreLayoutSnapshot(bad, model, options), /Invalid cached layout bounds/);
  }
});

test('an original bundle outside the canvas survives labels changing its greedy fallback', async () => {
  const { layoutSnapshot, restoreLayoutSnapshot } = await import('../eda/layout-snapshot.mjs');
  const { optimizeAnnotations } = await import('../eda/annotation-layout.mjs');
  const { model, options, result, bundleBadges } = await fixture();
  const locations = [[40, 700], [100, 100], [1500, 500], [1500, 750], [1900, 100], [1200, 100]];
  result.layout.children.forEach((node, i) => Object.assign(node, { x: locations[i][0], y: locations[i][1] }));
  const ports = new Map(result.layout.children.flatMap(node => node.ports.map(port => [port.id, { x: node.x + port.x, y: node.y + port.y }])));
  for (const edge of result.layout.edges) {
    const a = ports.get(edge.sources[0]), b = ports.get(edge.targets[0]), x = (a.x + b.x) / 2;
    edge.sections = [{ startPoint: a, bendPoints: [{ x, y: a.y }, { x, y: b.y }], endPoint: b }];
    for (const label of edge.labels || []) Object.assign(label, { x: edge.id === 'wire-6' ? 1200 : 800,
      y: edge.id === 'wire-0' ? 15 : edge.id === 'wire-6' ? 800 : 55 });
  }
  const foreign = result.layout.edges.find(edge => edge.id === 'wire-1').sections[0];
  foreign.bendPoints = [{ x: 880, y: foreign.startPoint.y }, { x: 880, y: 40 }, { x: 100, y: 40 }];
  result.layout.edges.find(edge => edge.id === 'wire-3').sections[0].bendPoints = [{ x: 460, y: 40 }, { x: 1200, y: 40 }];
  delete result.layout.annotationPositions;
  assert(result.layout.children.every(node => node.x >= 40 && node.y >= 40));
  assert.equal(bundleBadges(result)[0].y, 4);
  result.layout = optimizeAnnotations(result.layout, result.projection, { annotationBudgetMs: 1000 });
  assert.equal(bundleBadges(result)[0].y, 4, 'A conflict-free original candidate stays available');
  const canonical = bundleBadges({ ...result, layout: { ...result.layout, annotationPositions: undefined } });
  assert.equal(canonical[0].y, 60, 'Repaired captions change the greedy placement fallback');
  const restored = restoreLayoutSnapshot(layoutSnapshot(result), model, options);
  assert.equal(bundleBadges(restored)[0].y, 4);
});
