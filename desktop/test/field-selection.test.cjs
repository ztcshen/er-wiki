const { test } = require('node:test');
const assert = require('node:assert/strict');
test('field selection follows real relationships, not sibling branches in a shared net', async () => {
  const { fieldRelationshipIds } = await import('../eda/field-selection.mjs');
  const { matchesRelation } = await import('../eda/cardinality.mjs');
  const relationships = [0, 1, 2].map(id => ({ id, startTableId: id, startFieldId: 0, endTableId: 'parent', endFieldId: 0 }));
  const child = fieldRelationshipIds(relationships, 0, 0);
  assert.deepEqual(child, [0]);
  assert.deepEqual(fieldRelationshipIds(relationships, 'parent', 0), [0, 1, 2]);
  assert.equal(matchesRelation({ refs: [0, 1, 2], netIds: ['shared'] }, 'shared', null, child), true);
  assert.equal(matchesRelation({ refs: [1], netIds: ['shared'] }, 'shared', null, child), false);
  assert.equal(matchesRelation({ refs: [0], netIds: ['shared'] }, 'shared', null, []), false);
});
test('composite and conditional alternatives all belong to their selected field; hover is temporary', async () => {
  const { fieldRelationshipIds } = await import('../eda/field-selection.mjs');
  const { matchesRelation } = await import('../eda/cardinality.mjs');
  const relationships = ['A', 'B'].map(id => ({ id, startTableId: 0, endTableId: id,
    fields: [{ startFieldId: 0, endFieldId: 'id' }, { startFieldId: 'region', endFieldId: 'region' }],
    reviewEvidence: { condition: { field: 'kind', value: id } } }));
  const ids = fieldRelationshipIds(relationships, 0, 'region');
  assert.deepEqual(ids, ['A', 'B']);
  const edge = { refs: ['B'], netIds: ['B-net'] };
  assert.equal(matchesRelation(edge, null, null, ids), true);
  assert.equal(matchesRelation(edge, 'A-net', 'A', ids), false);
  assert.equal(matchesRelation(edge, null, null, ids), true);
});
