const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Execute the actual renderer boundary with explicit platform dependencies;
// validation itself is the real shared contract, not a passing stub.
function load(file, dependencies, name) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/export (async )?function/g, '$1function');
  return new Function(...Object.keys(dependencies), `${source}\nreturn ${name};`)(...Object.values(dependencies));
}

test('invalid imports and replacements reject before touching database, view, backup or undo', async () => {
  const contract = await import('../review/model-contract.mjs');
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const { modelGroups } = await import('../../work/drawdb/src/utils/tableGroups.js');
  const importModel = load('../renderer/model-file.js', { ...contract, modelGroups,
    resolveType: (_database, type) => ({ isSized: type === 'VARCHAR' }), tr: value => value }, 'importModel');
  const touched = [];
  const replaceWorkspace = load('../renderer/replace-workspace.js', { importModel,
    exportModel: () => touched.push('export'), bindingIssues: () => [],
    flushSync: () => touched.push('flush'), replacementRecord: () => touched.push('record'),
    commitReplacement: () => touched.push('commit') }, 'replaceWorkspace');
  const snapshot = { diagramId: 'same', tables: ['original'] };
  const current = { current: { snapshot, localWritable: true, readOnly: false,
    getContentKey: () => touched.push('content'), setReplacing: () => touched.push('lock'),
    applyReplacement: () => touched.push('apply') } };
  for (const change of [model => { model.relationships[1].id = model.relationships[0].id; },
    model => { model.relationships[3].reviewEvidence.condition.field = 'missing'; }]) {
    const model = conditionalModel(); change(model);
    const json = JSON.stringify(model);
    let error;
    try { importModel(json, 'fixture.json'); } catch (value) { error = value; }
    assert.equal(error?.code, 'MODEL_VALIDATION_FAILED');
    await assert.rejects(replaceWorkspace({ current, db: {}, action: 'replace-json', targetId: 'same', json }),
      value => value.code === error.code && JSON.stringify(value.errors) === JSON.stringify(error.errors));
    assert.deepEqual(touched, []);
    assert.deepEqual(snapshot, { diagramId: 'same', tables: ['original'] });
  }
});
