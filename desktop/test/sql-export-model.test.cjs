const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerHooks } = require('node:module');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const root = pathToFileURL(path.resolve(__dirname, '../../work/drawdb/src') + '/').href;
// Only the pinned upstream tree uses bundler-style extensionless imports.
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(root) && specifier.startsWith('.')) {
    const url = new URL(specifier, context.parentURL);
    for (const suffix of ['', '.js', '/index.js']) {
      const candidate = new URL(url.href + suffix);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return next(candidate.href, context);
    }
  }
  return next(specifier, context);
} });

test('actual MySQL and SQLite exporters emit only declared physical constraints without changing the model', async () => {
  const { sqlExportModel } = await import('../review/sql-export-model.mjs');
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const { exportSQL } = await import('../../work/drawdb/src/utils/exportSQL/index.js');
  for (const database of ['mysql', 'sqlite']) {
    const input = conditionalModel(); input.database = database;
    input.relationships[0].reviewEvidence = { kind: 'physical' };
    input.relationships[1].reviewEvidence = { kind: 'inferred' };
    const before = JSON.stringify(input), { model, skippedRelationships } = sqlExportModel(input);
    assert.equal(model.relationships.length, 1);
    assert.equal(skippedRelationships.length, 5);
    const sql = exportSQL(model);
    assert.match(sql, /FOREIGN KEY/i);
    assert.match(sql, /credit_id/);
    assert.equal((sql.match(/FOREIGN KEY/gi) || []).length, 1);
    assert.match(sql, /business_type/);
    assert.equal(JSON.stringify(input), before);
  }
});

test('conditional, invalid and unspecified constraints never become SQL FKs', async () => {
  const { sqlExportModel } = await import('../review/sql-export-model.mjs');
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const input = conditionalModel();
  input.relationships[0].reviewEvidence = { kind: 'physical' };
  input.relationships[0].endFieldId = 'missing';
  input.relationships[3].reviewEvidence.kind = 'physical';
  const result = sqlExportModel(input);
  assert.deepEqual(result.model.relationships, []);
  assert(result.skippedRelationships.some(r => r.reason === 'PHYSICAL_CONDITION_CONFLICT'));
  assert(result.skippedRelationships.some(r => r.reason === 'INVALID_ENDPOINTS'));
});

test('physical composite FK ordering survives both SQL writers and the desktop references shape', async () => {
  const { sqlExportModel } = await import('../review/sql-export-model.mjs');
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const { exportSQL } = await import('../../work/drawdb/src/utils/exportSQL/index.js');
  for (const database of ['mysql', 'sqlite']) {
    const input = conditionalModel(); input.database = database;
    const parent = input.tables[0], child = input.tables[1];
    parent.fields.push({ ...parent.fields[0], id: 'parent-region', name: 'region', primary: false });
    child.fields.push({ ...child.fields[0], id: 'child-region', name: 'region', primary: false });
    const relation = input.relationships[0];
    relation.reviewEvidence = { kind: 'physical' };
    relation.fields = [{ startFieldId: 'child-region', endFieldId: 'parent-region' },
      { startFieldId: relation.startFieldId, endFieldId: relation.endFieldId }];
    input.references = input.relationships; delete input.relationships;
    const before = JSON.stringify(input), { model } = sqlExportModel(input);
    const sql = exportSQL(model).replace(/["`]/g, '');
    assert.match(sql, /FOREIGN KEY\s*\(region, credit_id\)\s*REFERENCES credit_applications\s*\(region, id\)/i);
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(model.references, model.relationships);
  }
});

test('actual SQL worker marks explicit DDL foreign keys physical, without guessing named columns', async () => {
  const requireUpstream = createRequire(path.resolve(__dirname, '../../work/drawdb/package.json'));
  const { Parser } = requireUpstream('node-sql-parser');
  const { importSQL } = await import('../../work/drawdb/src/utils/importSQL/index.js');
  const { versionModelDocument } = await import('../renderer/model-format.mjs');
  const { sqlExportModel } = await import('../review/sql-export-model.mjs');
  const { exportSQL } = await import('../../work/drawdb/src/utils/exportSQL/index.js');
  const source = fs.readFileSync(path.resolve(__dirname, '../renderer/sql-import.worker.js'), 'utf8').replace(/^import.*;\n/gm, '');
  let result;
  const self = { postMessage: value => { result = value; } };
  new Function('Parser', 'importSQL', 'versionModelDocument', 'self', source)(Parser, importSQL, versionModelDocument, self);
  for (const ddl of [
    'CREATE TABLE parent (id INT PRIMARY KEY); CREATE TABLE child (id INT PRIMARY KEY, parent_id INT, FOREIGN KEY (parent_id) REFERENCES parent(id));',
    'CREATE TABLE parent (id INT PRIMARY KEY); CREATE TABLE child (id INT PRIMARY KEY, parent_id INT); ALTER TABLE child ADD FOREIGN KEY (parent_id) REFERENCES parent(id);',
  ]) {
    self.onmessage({ data: { sql: ddl, database: 'mysql' } });
    assert.equal(result.error, undefined);
    assert.equal(result.document.relationships.length, 1);
    assert.equal(result.document.relationships[0].reviewEvidence.kind, 'physical');
    assert.match(exportSQL(sqlExportModel(result.document).model), /FOREIGN KEY/);
  }
  self.onmessage({ data: { sql: 'CREATE TABLE parent (id INT PRIMARY KEY); CREATE TABLE child (parent_id INT);', database: 'mysql' } });
  assert.equal(result.error, undefined);
  assert.equal(result.document.relationships.length, 0);
});
