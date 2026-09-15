const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

test('real editor integration installs predicate repair and guarded endpoint swapping', async () => {
  const { integrateDesktop } = await import('../integrate.mjs');
  const id = '/src/components/EditorSidePanel/RelationshipsTab/RelationshipInfo.jsx';
  const source = fs.readFileSync(path.join(__dirname, '../../work/drawdb', id), 'utf8');
  const output = integrateDesktop('/desktop')(source, id);
  babel.parseSync(output, { configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] } });
  assert(output.includes('<RelationshipSemantics data={data} />'));
  assert(output.includes('validateRelationshipDraft({ ...relationshipDraft(data), ...redo }'));
  assert(output.indexOf('if (validation.errors.length)') < output.indexOf('setUndoStack(stack'));
});

test('real field update keeps condition references scoped through rename and undo', async () => {
  const { integrateDesktop } = await import('../integrate.mjs');
  const { renameConditionField } = await import('../review/relation-semantics.mjs');
  const id = '/src/context/DiagramContext.jsx';
  const source = fs.readFileSync(path.join(__dirname, '../../work/drawdb', id), 'utf8');
  const output = integrateDesktop('/desktop')(source, id);
  const ast = babel.parseSync(output, { configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] } });
  let update;
  babel.traverse(ast, { VariableDeclarator({ node }) { if (node.id.name === 'updateField') update = babel.transformFromAstSync(babel.types.file(babel.types.program([babel.types.expressionStatement(node.init)])), '', { configFile: false, babelrc: false }).code; } });
  assert(update);
  let tables = [{ id: 0, fields: [{ id: 0, name: 'kind' }] }];
  let relationships = [{ id: 0, startTableId: 0, reviewEvidence: { condition: { field: 'kind', value: 'A' } } }];
  const invoke = name => new Function('tables', 'setTables', 'setRelationships', 'renameConditionField', 'shouldEmit', `return ${update}`)(tables, fn => { tables = fn(tables); }, fn => { relationships = fn(relationships); }, renameConditionField, () => false)(0, 0, { name });
  invoke('category');
  assert.equal(tables[0].fields[0].name, 'category');
  assert.equal(relationships[0].reviewEvidence.condition.field, 'category');
  invoke('kind');
  assert.equal(relationships[0].reviewEvidence.condition.field, 'kind');
});
