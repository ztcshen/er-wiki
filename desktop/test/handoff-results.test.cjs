const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createModelHandoff } = require('../native/model-handoff.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('workspace readiness timeout ends with an identified failed receipt', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'er-handoff-timeout-'));
  try {
    const file = path.join(dir, 'model.json'); await fs.writeFile(file, '{}');
    let terminal;
    const done = new Promise(resolve => { terminal = resolve; });
    const handoff = createModelHandoff({ request: async () => assert.fail('workspace not ready'),
      timeoutMs: 5, writeResult: async result => { if (result.status === 'failed') terminal(result); } });
    await handoff.enqueue(['--replace-model', file, '--model-id', 'example'], dir);
    const result = await done;
    assert.equal(result.errorCode, 'WORKSPACE_TIMEOUT'); assert.equal(result.ok, false); assert(result.requestId);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('each parse/read failure replaces old success with an identified terminal receipt', async () => {
  const results = [{ ok: true, requestId: 'old' }];
  const handoff = createModelHandoff({ request: async () => true, writeResult: async value => results.push(value) });
  await assert.rejects(handoff.enqueue(['--replace-model', 'missing'], os.tmpdir()));
  const invalid = results.at(-1);
  assert.equal(invalid.status, 'failed'); assert.equal(invalid.errorCode, 'ARGUMENTS_INVALID');
  assert.equal(invalid.targetId, null); assert(invalid.requestId);
  await assert.rejects(handoff.enqueue(['--replace-model', '/nonexistent-er-wiki-model.json', '--model-id', 'example'], os.tmpdir()));
  const missing = results.at(-1);
  assert.equal(missing.status, 'failed'); assert.equal(missing.ok, false);
  assert.equal(missing.sha256, null); assert.notEqual(missing.requestId, invalid.requestId);
  assert.equal(missing.layoutStatus, 'not_observed');
});

test('structured validation errors reach the final receipt and pending uses ok:null', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'er-handoff-'));
  try {
    const file = path.join(dir, 'model.json'); await fs.writeFile(file, '{}');
    const results = [], errors = [{ code: 'CONDITION_FIELD_MISSING', path: 'relationships[0].reviewEvidence.condition.field', message: 'Missing' }];
    const handoff = createModelHandoff({ request: async () => ({ ok: false, errorCode: 'MODEL_VALIDATION_FAILED', message: 'Invalid', errors }), writeResult: async value => results.push(value) });
    handoff.ready('example');
    await handoff.enqueue(['--replace-model', file, '--model-id', 'example'], dir); await tick();
    assert(results.filter(r => r.status === 'pending').every(r => r.ok === null));
    assert.equal(results.at(-1).errorCode, 'MODEL_VALIDATION_FAILED');
    assert.deepEqual(results.at(-1).errors, errors);
    assert.equal(new Set(results.map(r => r.requestId)).size, 1);
    assert.match(results.at(-1).sha256, /^[a-f0-9]{64}$/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('late earlier success cannot overwrite a newer busy failure', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'er-handoff-race-'));
  try {
    const file = path.join(dir, 'model.json'); await fs.writeFile(file, '{}');
    let finish;
    const results = [], handoff = createModelHandoff({ request: () => new Promise(resolve => { finish = resolve; }), writeResult: async value => results.push(value) });
    handoff.ready('example');
    const args = ['--replace-model', file, '--model-id', 'example'];
    await handoff.enqueue(args, dir); await tick();
    await assert.rejects(handoff.enqueue(args, dir), /in progress/);
    const latest = results.at(-1); assert.equal(latest.errorCode, 'WORKSPACE_BUSY');
    finish(true); await tick();
    assert.equal(results.at(-1), latest);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
