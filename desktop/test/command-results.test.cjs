const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCommandBridge } = require('../native/command-bridge.cjs');
const { registerDesktopIpc } = require('../native/ipc.cjs');

test('structured validation errors survive trusted IPC while legacy commands remain boolean', async () => {
  const sent = [], listeners = new Map();
  const frame = { url: 'erwiki://app/editor/diagrams/example' };
  const webContents = { mainFrame: frame, send: (_channel, value) => sent.push(value) };
  const window = { isDestroyed: () => false, webContents };
  const bridge = createCommandBridge(() => window);
  registerDesktopIpc({ ipcMain: { handle() {}, on: (key, fn) => listeners.set(key, fn) },
    getWindow: () => window, bridge });
  const reply = listeners.get('desktop:command-result');
  const result = { ok: false, errorCode: 'MODEL_VALIDATION_FAILED', message: 'Invalid condition',
    errors: [{ code: 'CONDITION_FIELD_MISSING', path: 'relationships[0].reviewEvidence.condition.field', message: 'Missing field' }] };
  const detailed = bridge.requestDetailed({ action: 'replace-json' });
  reply({ sender: webContents, senderFrame: { ...frame } }, { id: sent[0].id, result });
  assert.equal(bridge.pendingCount, 1);
  reply({ sender: webContents, senderFrame: frame }, { id: sent[0].id, result });
  assert.deepEqual(await detailed, result);
  const legacy = bridge.request('leave');
  reply({ sender: webContents, senderFrame: frame }, { id: sent[1].id, result });
  assert.equal(await legacy, false, 'an object carrying ok:false must not permit leaving');
  const oldReply = bridge.request('save');
  reply({ sender: webContents, senderFrame: frame }, { id: sent[2].id, ok: true });
  assert.equal(await oldReply, true);
});

test('detailed bridge has explicit failure causes for missing windows and timeouts', async () => {
  assert.equal((await createCommandBridge(() => null).requestDetailed('replace-json')).errorCode, 'WORKSPACE_UNAVAILABLE');
  const bridge = createCommandBridge(() => ({ isDestroyed: () => false, webContents: { send() {} } }), 5);
  assert.equal((await bridge.requestDetailed('replace-json')).errorCode, 'COMMAND_TIMEOUT');
  assert.equal(bridge.pendingCount, 0);
});
