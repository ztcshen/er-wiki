const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = () => ({ tables: [
  { id: 0, name: 'events', fields: [{ id: 0, name: 'id', type: 'BIGINT' }, { id: 1, name: 'kind', type: 'VARCHAR' }, { id: 2, name: 'object_id', type: 'BIGINT' }] },
  { id: 1, name: 'orders', fields: [{ id: 0, name: 'id', type: 'BIGINT' }] },
], relationships: [{ id: 0, name: 'event_order', startTableId: 0, startFieldId: 2, endTableId: 1, endFieldId: 0, cardinality: 'many_to_one', reviewEvidence: { kind: 'logical', condition: { field: 'kind', value: 0 } } }], groups: [] });

test('numeric zero remains a visible condition and missing predicate fields are diagnosed', async () => {
  const { relationCondition } = await import('../eda/relation-condition.mjs');
  const { checkModel } = await import('../review/model-checks.mjs');
  const m = fixture(); assert.deepEqual(relationCondition(m.relationships[0]), { field: 'kind', value: '0' });
  m.relationships[0].reviewEvidence.condition.field = 'missing';
  assert(checkModel(m).some(i => i.code === 'CONDITION_FIELD_MISSING'));
});

test('different predicates can share endpoints, while an identical predicate is duplicate', async () => {
  const { validateRelationshipDraft, relationshipDraft } = await import('../review/relationship-draft.mjs');
  const { checkModel } = await import('../review/model-checks.mjs');
  const m = fixture(), a = m.relationships[0];
  const b = { ...structuredClone(a), id: 1 }; b.reviewEvidence.condition.value = 'OTHER'; m.relationships.push(b);
  assert(!checkModel(m).some(i => i.code === 'relation_duplicate'));
  assert.deepEqual(validateRelationshipDraft(relationshipDraft(a), m.tables, m.relationships, a.id).errors, []);
  b.reviewEvidence.condition.value = '0';
  assert(checkModel(m).some(i => i.code === 'relation_duplicate'));
  assert(validateRelationshipDraft(relationshipDraft(a), m.tables, m.relationships, a.id).errors.length);
});

test('invalid conditions stay isolated and labeled, never become ordinary bundled links', async () => {
  const { projectModel } = await import('../eda/model.mjs');
  const m = fixture(); m.relationships[0].reviewEvidence.condition.value = false;
  const result = projectModel(m, { level: 'overview', labels: 'off', bundle: true });
  assert.equal(result.covered.length, 1);
  assert.equal(result.edges[0].kind, 'conditional');
  assert(result.edges[0].labels[0].text.includes('条件无效'));
});

test('semantics distinguishes declared, inferred, unknown and conflicting evidence without mutating input', async () => {
  const { resolveRelationSemantics, renameConditionField } = await import('../review/relation-semantics.mjs');
  assert.equal(resolveRelationSemantics({ name: 'fk_invented' }).type, 'unspecified');
  assert.equal(resolveRelationSemantics({ reviewEvidence: { kind: 'physical' } }).canExportForeignKey, true);
  assert.equal(resolveRelationSemantics({ reviewEvidence: { kind: 'inferred' } }).certainty, 'inferred');
  for (const value of [false, null, {}, [], 1.2, Number.MAX_SAFE_INTEGER + 1, ' ']) {
    const relation = { reviewEvidence: { condition: { field: 'kind', value } } };
    assert.equal(resolveRelationSemantics(relation).conditionState, 'invalid');
  }
  const m = fixture(), before = JSON.stringify(m);
  m.relationships.push({ ...structuredClone(m.relationships[0]), id: 9, startTableId: 1 });
  const renamed = renameConditionField(m.relationships, 0, 'kind', 'event_kind');
  assert.equal(renamed[0].reviewEvidence.condition.field, 'event_kind');
  assert.equal(renamed[1].reviewEvidence.condition.field, 'kind');
  assert.equal(JSON.stringify(fixture()), before);
  assert.equal(m.relationships[0].reviewEvidence.condition.field, 'kind');
});
