const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { modelCommandArgs } = require('../native/model-command-args.cjs');
const { createModelHandoff } = require('../native/model-handoff.cjs');
test('model commands require explicit export paths and validate concurrency hashes', () => {
  assert.deepEqual(modelCommandArgs(['--inspect-model'], '/tmp'), { operation: 'inspect-model' });
  assert.equal(modelCommandArgs(['--export-model', 'a.json', '--model-id', 'example'], '/tmp').file, '/tmp/a.json');
  assert.equal(modelCommandArgs(['--replace-model', 'a.json', '--model-id', 'example', '--expected-content-hash', 'a'.repeat(64)], '/tmp').expectedContentHash, 'a'.repeat(64));
  assert.throws(() => modelCommandArgs(['--export-model', '--model-id', 'example'], '/tmp'));
  assert.throws(() => modelCommandArgs(['--inspect-model', '--replace-model', 'a'], '/tmp'));
  assert.throws(() => modelCommandArgs(['--inspect-model', '--overwrite'], '/tmp'));
});
test('native inspect/export are read commands; export never clobbers without explicit overwrite', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'er-model-export-'));
  try {
    const file = path.join(directory, 'out.json'), requests = [];
    let resolveTerminal;
    const handoff = createModelHandoff({ request: async action => {
      requests.push(action); return { ok: true, modelId: 'example', json: '{"title":"current unsaved"}', contentHash: 'a'.repeat(64), hasUnsavedChanges: true, draftStatus: 'none' };
    }, writeResult: async result => { if (result.status !== 'pending') resolveTerminal(result); } });
    handoff.ready('example');
    const invoke = async args => {
      const done = new Promise(resolve => { resolveTerminal = resolve; });
      await handoff.enqueue(args, directory); const result = await done;
      await new Promise(resolve => setImmediate(resolve)); return result;
    };
    const identity = await invoke(['--inspect-model']);
    assert.equal(identity.targetId, 'example'); assert.equal(identity.hasUnsavedChanges, true); assert.equal(identity.json, undefined);
    await fs.writeFile(file, 'original');
    const args = ['--export-model', file, '--model-id', 'example'];
    const conflict = await invoke(args);
    assert.equal(conflict.ok, false); assert.equal(conflict.errorCode, 'EEXIST');
    assert.equal(await fs.readFile(file, 'utf8'), 'original');
    const success = await invoke([...args, '--overwrite']);
    assert.equal(success.ok, true); assert.match(success.sha256, /^[a-f0-9]{64}$/);
    assert.equal(await fs.readFile(file, 'utf8'), '{"title":"current unsaved"}');
    assert(requests.every(request => request.action === 'read-current'));
    assert.deepEqual(await fs.readdir(directory), ['out.json']);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
