const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = () => {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '../../examples/fulfillment.drawdb.json'), 'utf8'));
  return { ...d, groups: d.reviewGroups };
};
const view = (model, id = 'orders') => ({ id, name: 'Orders', depicts: model.tables.slice(0, 3).map(t => ({ tableId: t.id })) });

test('legacy models migrate while saved views survive JSON roundtrips without copying tables', async () => {
  const { migrateModelDocument } = await import('../renderer/model-format.mjs');
  const m = fixture(); delete m.diagramViews;
  const before = JSON.stringify(m);
  assert.deepEqual(migrateModelDocument(m).diagramViews, []);
  m.diagramViews = [view(m), { ...view(m, 'stock'), depicts: view(m).depicts.map(d => ({ ...d, x: 1200, y: 80 })) }];
  const migrated = migrateModelDocument(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(migrated.diagramViews, m.diagramViews);
  assert.deepEqual(migrated.tables, JSON.parse(before).tables);
  assert.equal(migrated.schemaVersion, 3);
  assert.throws(() => migrateModelDocument({ ...m, schemaVersion: 4 }), /newer/);
});

test('invalid table references, duplicates and malformed coordinates cannot enter a saved view', async () => {
  const { validateDiagramViews } = await import('../eda/diagram-views.mjs');
  const m = fixture();
  for (const change of [v => v.depicts.push(v.depicts[0]), v => v.depicts[0].tableId = 'missing', v => v.depicts[0].x = NaN,
    v => { v.depicts[0].x = -1; v.depicts[0].y = 10; }, v => v.depicts[0].table = m.tables[0], v => v.depicts[0].hiddenFieldIds = ['missing']]) {
    const v = view(m); change(v); assert.throws(() => validateDiagramViews([v], m.tables), /diagramViews\[0\]/);
  }
  assert.throws(() => validateDiagramViews([view(m), view(m)], m.tables), /unique/);
});

test('per-view membership, color and field visibility never mutate the shared model', async () => {
  const { projectModel } = await import('../eda/model.mjs');
  const m = fixture(), a = view(m), b = view(m, 'stock');
  a.depicts[0].hiddenFieldIds = [m.tables[0].fields[0].id]; a.depicts[0].color = '#ff9900';
  const before = JSON.stringify(m), pa = projectModel(m, { level: 'overview', labels: 'off', diagramView: a });
  const pb = projectModel(m, { level: 'overview', labels: 'off', diagramView: b });
  assert.equal(pa.nodes.filter(n => n.kind === 'table').length, 3);
  assert.equal(pa.nodes.find(n => n.tableId === a.depicts[0].tableId).color, '#ff9900');
  assert(!pa.nodes.find(n => n.tableId === a.depicts[0].tableId).fields.some(f => f.id === m.tables[0].fields[0].id));
  assert(pb.nodes.find(n => n.tableId === a.depicts[0].tableId).fields.some(f => f.id === m.tables[0].fields[0].id));
  assert.equal(JSON.stringify(m), before);
});

test('saved geometry edits affect one view, and cache keys include its positions but not display colors', async () => {
  const { moveViewDepict, resetViewGeometry } = await import('../eda/diagram-views.mjs');
  const { geometryKey } = await import('../eda/layout-content.mjs');
  const { projectModel } = await import('../eda/model.mjs');
  const { canonicalModelContent } = await import('../renderer/model-content.mjs');
  const m = fixture(), a = view(m), before = JSON.stringify(m), p = projectModel(m, { level: 'overview', diagramView: a });
  const result = { projection: p, layout: { children: p.nodes.map((n, i) => ({ ...n, x: 40 + i * 500, y: 40 })) } };
  const changed = moveViewDepict(a, result, a.depicts[0].tableId, 120, 400);
  assert.equal(changed.depicts[0].x, 120); assert.equal(changed.depicts[0].y, 400);
  assert.equal(a.depicts[0].x, undefined); assert.equal(JSON.stringify(m), before);
  assert.notEqual(geometryKey(m, { diagramView: a }), geometryKey(m, { diagramView: changed }));
  assert.equal(geometryKey(m, { diagramView: changed }), geometryKey(m, { diagramView: { ...changed, depicts: changed.depicts.map(d => ({ ...d, color: '#eeeeee' })) } }));
  assert.notEqual(canonicalModelContent({ ...m, diagramViews: [a] }), canonicalModelContent({ ...m, diagramViews: [changed] }));
  assert(resetViewGeometry(changed).depicts.every(d => d.x === undefined && d.y === undefined));
});

test('view navigation preserves legacy camera keys and isolates two named views', async () => {
  const { scopeKey, restoreLocation } = await import('../eda/reading-state.mjs');
  assert.equal(scopeKey({}), '["overview","",null,"off",true,[]]');
  assert.notEqual(scopeKey({ diagramViewId: 'a' }), scopeKey({ diagramViewId: 'b' }));
  const m = fixture();m.diagramViews = [view(m)];
  assert.equal(restoreLocation({ diagramViewId: 'missing' }, m).diagramViewId, '');
  assert.equal(restoreLocation({ diagramViewId: 'orders' }, m).diagramViewId, 'orders');
});

test('explicit candidates remain separate from confirmed edges and SQL constraints', async () => {
  const { deriveNets } = await import('../eda/model.mjs');
  const { sqlExportModel } = await import('../review/sql-export-model.mjs');
  const { resolveRelationSemantics } = await import('../review/relation-semantics.mjs');
  const m = fixture(), pending = m.relationships[0];
  pending.reviewEvidence = { ...pending.reviewEvidence, kind: 'physical', status: 'candidate' };
  const before = JSON.stringify(m);
  assert(!deriveNets(m).some(n => n.members.some(r => r.id === pending.id)));
  assert(deriveNets(m, { showCandidates: true }).some(n => n.members.some(r => r.id === pending.id)));
  const output = sqlExportModel(m);
  assert(!output.model.relationships.some(r => r.id === pending.id));
  assert.equal(output.skippedRelationships.find(r => r.id === pending.id).reason, 'UNCONFIRMED_CANDIDATE');
  assert.equal(resolveRelationSemantics(pending).status, 'candidate');
  assert.equal(JSON.stringify(m), before);
  pending.reviewEvidence.status = 'confirmed';
  assert(deriveNets(m).some(n => n.members.some(r => r.id === pending.id)));
  assert(sqlExportModel(m).model.relationships.some(r => r.id === pending.id));
  assert(resolveRelationSemantics({ ...pending, reviewEvidence: { kind: 'physical', status: 'automatic' } }).errors.some(e => e.code === 'RELATION_STATUS_INVALID'));
});
