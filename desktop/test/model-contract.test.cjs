const { test } = require('node:test');
const assert = require('node:assert/strict');
const typeInfo = type => ({ isSized: type === 'VARCHAR', hasPrecision: type === 'DECIMAL' });
const setup = async () => {
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  return conditionalModel();
};

test('MySQL text/blob without length round-trips without changing schema', async () => {
  await import('../../scripts/lib/upstream-node.mjs');
  const { validateModelDocument } = await import('../review/model-contract.mjs');
  const { dbToTypes } = await import('../../work/drawdb/src/data/datatypes.js');
  for (const type of ['TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'BLOB', 'MEDIUMBLOB']) {
    const input = await setup(); input.database = 'mysql';
    const field = input.tables[0].fields[0];
    field.type = type; delete field.size;
    const before = JSON.stringify(input);
    const options = { typeInfo: t => dbToTypes.mysql[t] || {} };
    const result = validateModelDocument(input, options);
    assert(!result.errors.some(e => e.code === 'field_size'), type);
    assert.equal(JSON.stringify(input), before);
    assert.equal(result.model.tables[0].fields[0].size, undefined);
    field.size = '-1';
    if (dbToTypes.mysql[type].isSized)
      assert(validateModelDocument(input, options).errors.some(e => e.code === 'field_size'), type);
    field.type = 'VARCHAR'; delete field.size;
    assert(validateModelDocument(input, options).errors.some(e => e.code === 'field_size'));
  }
});

test('numeric zero entity identifiers survive the complete validation contract', async () => {
  const { validateModelDocument } = await import('../review/model-contract.mjs');
  const input = await setup(), table = input.tables[0], oldTable = table.id, oldField = table.fields[0].id;
  table.id = 0; table.fields[0].id = 0;
  for (const group of input.groups) group.tableIds = group.tableIds.map(id => id === oldTable ? 0 : id);
  for (const relation of input.relationships) {
    if (relation.endTableId === oldTable) { relation.endTableId = 0; if (relation.endFieldId === oldField) relation.endFieldId = 0; }
    if (relation.startTableId === oldTable) { relation.startTableId = 0; if (relation.startFieldId === oldField) relation.startFieldId = 0; }
  }
  input.relationships[0].id = 0;
  const before = JSON.stringify(input), result = validateModelDocument(input, { typeInfo });
  assert.deepEqual(result.errors, []);
  assert.equal(result.model.tables[0].id, 0);
  assert.equal(result.model.relationships[0].id, 0);
  assert.equal(result.model.relationships[0].fields[0].endFieldId, 0);
  assert.equal(JSON.stringify(input), before);
});

test('legacy relationships normalize without guessing physical constraints or mutating input', async () => {
  const { validateModelDocument } = await import('../review/model-contract.mjs');
  const input = await setup(), before = JSON.stringify(input);
  const result = validateModelDocument(input, { typeInfo });
  assert.deepEqual(result.errors, []);
  assert.equal(result.model.relationships[0].reviewEvidence.kind, 'unspecified');
  assert.equal(result.model.relationships[0].fields.length, 1);
  assert.equal(JSON.stringify(input), before);
  assert(validateModelDocument(input).errors.some(e => e.code === 'TYPE_CATALOGUE_REQUIRED'));
});

test('shared validation rejects invalid kind/cardinality/conditions with actionable paths', async () => {
  const { validateModelDocument, requireValidModelDocument } = await import('../review/model-contract.mjs');
  for (const [change, expected] of [
    [r => { r.reviewEvidence.kind = 'bogus'; }, 'RELATION_KIND_INVALID'],
    [r => { r.cardinality = 'bogus'; }, 'RELATION_CARDINALITY_INVALID'],
    [r => { r.reviewEvidence.kind = 'physical'; }, 'PHYSICAL_CONDITION_CONFLICT'],
    [r => { r.reviewEvidence.condition.field = 'missing'; }, 'CONDITION_FIELD_MISSING'],
    [r => { r.reviewEvidence.condition.value = false; }, 'CONDITION_VALUE_INVALID'],
    [r => { r.reviewEvidence.condition.operator = 'eval'; }, 'CONDITION_INVALID'],
  ]) {
    const input = await setup(); change(input.relationships[3]);
    const result = validateModelDocument(input, { typeInfo });
    const error = result.errors.find(e => e.code === expected);
    assert(error, expected); assert(error.path.startsWith('relationships[3].'));
    assert.throws(() => requireValidModelDocument(input, { typeInfo }), e => e.code === 'MODEL_VALIDATION_FAILED' && e.errors.some(v => v.code === expected));
  }
});

test('safe integer predicates canonicalize, and composite mappings keep the authoritative ordered pairs', async () => {
  const { validateModelDocument } = await import('../review/model-contract.mjs');
  const input = await setup(); input.relationships[3].reviewEvidence.condition.value = 0;
  const r = input.relationships[0]; r.fields = [{ startFieldId: r.startFieldId, endFieldId: r.endFieldId }]; r.startFieldId = 'stale';
  const result = validateModelDocument(input, { typeInfo });
  assert.deepEqual(result.errors, []);
  assert.equal(result.model.relationships[3].reviewEvidence.condition.value, '0');
  assert.equal(result.model.relationships[0].startFieldId, r.fields[0].startFieldId);
  assert(result.warnings.some(w => w.code === 'LEGACY_PAIR_NORMALIZED'));
  input.relationships[0].fields = [];
  assert(validateModelDocument(input, { typeInfo }).errors.length);
});

test('duplicate relationship IDs and bad length formats are errors in the common contract', async () => {
  const { validateModelDocument } = await import('../review/model-contract.mjs');
  const input = await setup(); input.relationships[1].id = input.relationships[0].id;
  input.tables.find(t => t.name === 'notifications').fields.find(f => f.name === 'business_type').size = '-1';
  const result = validateModelDocument(input, { typeInfo });
  assert(result.errors.some(e => e.code === 'relation_id' && e.path === 'relationships[1].id'));
  assert(result.errors.some(e => e.code === 'field_size'));
});

test('closed SQL enums reject undeclared predicates while annotation enums only warn', async () => {
  const { validateModelDocument } = await import('../review/model-contract.mjs');
  const input = await setup(), field = input.tables.find(t => t.name === 'notifications').fields.find(f => f.name === 'business_type');
  field.reviewEnumValues = [{ value: 'OTHER', label: 'Other' }];
  let result = validateModelDocument(input, { typeInfo });
  assert.deepEqual(result.errors, []); assert(result.warnings.some(w => w.code === 'CONDITION_ENUM_VALUE'));
  field.type = 'ENUM'; field.values = ['OTHER'];
  result = validateModelDocument(input, { typeInfo });
  assert(result.errors.some(e => e.code === 'CONDITION_ENUM_VALUE'));
});
