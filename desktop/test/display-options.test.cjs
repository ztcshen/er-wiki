const { test } = require('node:test');
const assert = require('node:assert/strict');

test('display updates accept only boolean presentation preferences and preserve unrelated settings', async () => {
  const { normalizeDisplayOptions, displayOptionsPatch } = await import('../eda/display-options.mjs');
  const saved = Object.freeze({ autosave: true, language: 'zh', edaGrid: false, edaDimOthers: false });
  const update = Object.freeze({ edaGrid: true, edaPortMarkers: false, edaMetrics: true, edaRelationLabels: 'false',
    autosave: false, tables: [], selectedTable: 'orders', edaCardinality: null });
  const merged = { ...saved, ...displayOptionsPatch(update) };
  assert.equal(merged.autosave, true); assert.equal(merged.language, 'zh');
  assert.equal(merged.edaGrid, true); assert.equal(merged.edaPortMarkers, false);
  assert.equal(merged.edaDimOthers, false); assert.equal(merged.edaMetrics, true);
  assert.equal(Object.hasOwn(merged, 'tables'), false); assert.equal(Object.hasOwn(merged, 'selectedTable'), false);
  const view = normalizeDisplayOptions(JSON.parse(JSON.stringify(merged)));
  assert.equal(view.edaGrid, true); assert.equal(view.edaDimOthers, false);
  assert.equal(view.edaRelationLabels, true); assert.equal(view.edaCardinality, true);
  assert.equal(Object.hasOwn(view, 'autosave'), false);
});

test('legacy and malformed preferences keep the original visible diagram defaults', async () => {
  const { normalizeDisplayOptions, displayOptionsPatch } = await import('../eda/display-options.mjs');
  for (const value of [undefined, null, false, [], 'hidden', { edaGrid: 0, edaDimOthers: 'false' }, Object.create({ edaGrid: false })]) {
    const view = normalizeDisplayOptions(value);
    assert.equal(view.edaGrid, true); assert.equal(view.edaRelationLabels, true);
    assert.equal(view.edaPortMarkers, true); assert.equal(view.edaDimOthers, true);
    assert.equal(view.edaCardinality, true); assert.equal(view.edaSemanticZoom, true);
    assert.equal(view.edaMinimap, true); assert.equal(view.edaMetrics, false);
    assert.deepEqual(displayOptionsPatch(value), {});
  }
});

test('focus fade can be disabled without weakening selected relation emphasis', async () => {
  const { displayOpacity } = await import('../eda/display-options.mjs');
  for (const inactiveOpacity of [0.15, 0.2, 0.3]) {
    assert.equal(displayOpacity(true, false, true, inactiveOpacity), inactiveOpacity);
    assert.equal(displayOpacity(true, false, false, inactiveOpacity), 1);
    assert.equal(displayOpacity(true, true, true, inactiveOpacity), 1);
    assert.equal(displayOpacity(false, false, true, inactiveOpacity), 1);
  }
});
