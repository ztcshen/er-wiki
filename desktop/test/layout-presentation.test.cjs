const { test } = require('node:test');
const assert = require('node:assert/strict');
test('changed geometry is deferred after camera or selection changes, not after no-op progress', async () => {
  const { readingToken, deferImprovement } = await import('../eda/layout-presentation.mjs');
  const view = [0, 0, 800, 600], location = { selectedTable: 0, selectedField: 0 };
  const token = readingToken(view, location), preview = { layout: { children: [{ id: 0, x: 0 }] } }, final = { layout: { children: [{ id: 0, x: 10 }] } };
  assert.equal(deferImprovement(preview, final, token, token), false);
  assert.equal(deferImprovement(preview, final, token, readingToken([10, 0, 800, 600], location)), true);
  assert.equal(deferImprovement(preview, final, token, readingToken(view, { selectedTable: 0, selectedField: 1 })), true);
  assert.equal(deferImprovement(preview, structuredClone(preview), token, 'changed'), false);
  assert.equal(deferImprovement(null, final, token, 'changed'), false);
});
