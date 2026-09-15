const { test } = require('node:test');
const assert = require('node:assert/strict');
test('review context is optional, validated and preserved without changing the model', async () => {
  const { validateModelDocument } = await import('../review/model-contract.mjs');
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const model = conditionalModel(), options = { typeInfo: type => ({ isSized: type === 'VARCHAR' }) };
  for (const kind of ['design', 'observed', 'unknown']) {
    model.tables[0].reviewContext = { purpose: 'Fictional credit application', grain: 'One application', authority: { kind, summary: 'Example evidence', source: { kind: 'doc', locator: 'example.md' } } };
    const before = JSON.stringify(model), result = validateModelDocument(model, options);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.model.tables[0].reviewContext, model.tables[0].reviewContext);
    assert.equal(JSON.stringify(model), before);
  }
  model.tables[0].reviewContext.authority.kind = 'verified-production';
  assert(validateModelDocument(model, options).errors.some(error => error.code === 'TABLE_CONTEXT_INVALID' && error.path === 'tables[0].reviewContext.authority.kind'));
});
test('constraint fields retain order, numeric zero and unresolved/ambiguous references', async () => {
  const { tableConstraints } = await import('../review/table-review.mjs');
  const table = { fields: [{ id: 0, name: 'id', primary: true }, { id: 'a', name: 'region' }, { id: 'b', name: 'a' }],
    indices: [{ name: 'ordered', unique: false, fields: ['region', 0, 'missing', 'a'] }] };
  const list = tableConstraints(table);
  assert.equal(list[0].kind, 'primary');
  assert.deepEqual(list[1].fields.slice(0, 2), [{ id: 'a', name: 'region' }, { id: 0, name: 'id' }]);
  assert(list[1].fields[2].invalid); assert(list[1].fields[3].ambiguous);
});
test('business names do not change table identities or layout geometry', async () => {
  const { geometryKey, refreshLayoutContent } = await import('../eda/layout-content.mjs');
  const { projectModel } = await import('../eda/model.mjs');
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const model = conditionalModel(), options = { level: 'overview' }, key = geometryKey(model, options);
  const projection = projectModel(model, options), name = model.tables[0].name;
  model.tables[0].reviewChineseName = '授信申请';
  assert.equal(geometryKey(model, options), key);
  const next = refreshLayoutContent({ projection }, model).projection.nodes.find(n => n.tableId === model.tables[0].id);
  assert.equal(next.title, name); assert.equal(next.businessName, '授信申请');
});
