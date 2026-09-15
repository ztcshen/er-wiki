const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('content hash ignores reading/save metadata but preserves meaningful array order and model edits', async () => {
  const { modelContentHash } = await import('../renderer/model-content.mjs');
  const model = { title: 'Example', tables: [{ id: 0, name: 'a', fields: [{ id: 0, name: 'x' }, { id: 1, name: 'y' }] }], relationships: [], transform: { zoom: 1 }, lastModified: 'old' };
  const before = JSON.stringify(model), hash = await modelContentHash(model);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(await modelContentHash({ lastModified: 'new', ...model, transform: { zoom: 3 }, pan: { x: 99 }, cache: {} }), hash);
  const reorderedKeys = { relationships: [], tables: model.tables, title: 'Example' };
  assert.equal(await modelContentHash(reorderedKeys), hash);
  assert.notEqual(await modelContentHash({ ...model, tables: [{ ...model.tables[0], fields: [...model.tables[0].fields].reverse() }] }), hash);
  assert.notEqual(await modelContentHash({ ...model, title: 'Edited' }), hash);
  assert.equal(JSON.stringify(model), before);
});

test('read draft gate never blurs, saves or discards active editor content', async () => {
  const { assertReadableDraft } = await import('../renderer/model-content.mjs');
  let blurred = false;
  const document = { querySelector: () => true, activeElement: { blur: () => { blurred = true; } } };
  assert.throws(() => assertReadableDraft(document), error => error.code === 'EDITOR_DRAFT_ACTIVE');
  assert.equal(blurred, false);
  assert.doesNotThrow(() => assertReadableDraft({ querySelector: () => null, activeElement: null }));
});

test('read workspace returns committed React content including unsaved edits without saving', async () => {
  const { modelContentHash, assertReadableDraft } = await import('../renderer/model-content.mjs');
  const source = fs.readFileSync(path.join(__dirname, '../renderer/read-workspace.js'), 'utf8').replace(/^import.*;\n/gm, '').replace('export async function', 'async function');
  const readWorkspace = new Function('modelContentHash', 'assertReadableDraft', 'document', 'exportModel', `${source}\nreturn readWorkspace;`)(modelContentHash, assertReadableDraft,
    { querySelector: () => null, activeElement: null }, snapshot => JSON.stringify(snapshot.document));
  const current = { current: { ready: true, snapshot: { diagramId: 'example', document: { title: 'Unsaved edit', tables: [] } }, isDirty: () => true } };
  const result = await readWorkspace(current, 'example');
  assert.equal(JSON.parse(result.json).title, 'Unsaved edit');
  assert.equal(result.hasUnsavedChanges, true);
  assert.equal(result.modelId, 'example');
  await assert.rejects(readWorkspace(current, 'wrong'), error => error.code === 'TARGET_MISMATCH');
});
