const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const run = file => {
  const child = spawnSync(process.execPath, ['scripts/validate-model.mjs', '--file', file, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(child.stderr, '');
  return { status: child.status, result: JSON.parse(child.stdout) };
};
test('headless validation uses real dialect lengths and returns JSON without changing inputs', async () => {
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'er-wiki-cli-'));
  const file = path.join(directory, 'fixture.json');
  try {
    const model = conditionalModel();
    fs.writeFileSync(file, JSON.stringify(model));
    const before = fs.readFileSync(file, 'utf8');
    assert.equal(run(file).status, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    model.tables.at(-1).fields.find(f => f.type === 'VARCHAR').size = '-1';
    fs.writeFileSync(file, JSON.stringify(model));
    const invalid = run(file);
    assert.equal(invalid.status, 2);
    assert(invalid.result.errors.some(e => e.code === 'field_size' && e.path.includes('fields')));
    fs.writeFileSync(file, '{');
    assert.equal(run(file).result.errors[0].code, 'JSON_INVALID');
    fs.writeFileSync(file, JSON.stringify({ tables: {} }));
    assert.equal(run(file).status, 2);
    assert.equal(run(path.join(directory, 'missing.json')).status, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
