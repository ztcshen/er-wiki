const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createCommandBridge } = require('../native/command-bridge.cjs');
const { registerDesktopIpc } = require('../native/ipc.cjs');
const { createDialogQueue } = require('../native/dialogs.cjs');

test('native command bridge correlates replies, handles termination, and fails closed on timeout', async () => {
  const sent = [], window = { isDestroyed: () => false, webContents: { send: (...args) => sent.push(args) } };
  const bridge = createCommandBridge(() => window, 10);
  const first = bridge.request('leave'); assert.equal(bridge.pendingCount, 1);
  assert.equal(bridge.settle('unrelated', true), false);
  bridge.settle(sent[0][1].id, true); assert.equal(await first, true); assert.equal(bridge.pendingCount, 0);
  const stopped = bridge.request('export'); bridge.cancelAll(); assert.equal(await stopped, false);
  assert.equal(await bridge.request('leave'), false); assert.equal(bridge.pendingCount, 0);
  const absent = createCommandBridge(() => null); assert.equal(await absent.request('leave'), false);
});

test('all preload invoke capabilities are registered and reject an untrusted frame before any action', async () => {
  const handlers = new Map(), listeners = new Map();
  const ipcMain = { handle: (name, fn) => handlers.set(name, fn), on: (name, fn) => listeners.set(name, fn) };
  const frame = { url: 'erwiki://app/editor/diagrams/test-model' }, contents = { mainFrame: frame };
  const window = { webContents: contents };
  registerDesktopIpc({ ipcMain, getWindow: () => window, version: '0.2-test', preferences: { get: () => ({ language: 'en' }) } });
  const preload = fs.readFileSync(path.join(__dirname, '../preload.cjs'), 'utf8');
  const channels = [...preload.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map(match => match[1]);
  assert.deepEqual([...handlers.keys()].sort(), channels.sort());
  for (const [channel, handler] of handlers) {
    await assert.rejects(Promise.resolve().then(() => handler({ sender: contents, senderFrame: { url: frame.url } })), /Untrusted/, channel);
  }
  assert.equal(handlers.get('desktop:get-preferences')({ sender: contents, senderFrame: frame }).version, '0.2-test');
  assert(listeners.has('desktop:command-result'));
});

test('native dialog serialization releases its lock even when a chooser fails', async () => {
  const run = createDialogQueue(value => value);
  let release;
  const first = run(() => new Promise(resolve => { release = resolve; }));
  await assert.rejects(run(() => true), /关闭/); release(true); assert.equal(await first, true);
  await assert.rejects(run(() => { throw new Error('fixture failure'); }), /fixture/);
  assert.equal(await run(() => 42), 42);
});

test('layout task ignores mismatched responses and disposes workers on success, cancellation and failure', async () => {
  const { createLayoutTask } = await import('../eda/layout-task.mjs');
  const make = () => ({ terminate() { this.stopped = true; }, postMessage(value) { this.sent = value; } });
  const worker = make(), task = createLayoutTask(() => worker, { tables: [] }, {}, { id: 7 });
  worker.onmessage({ data: { id: 6, result: 'stale' } }); assert(!worker.stopped);
  worker.onmessage({ data: { id: 7, result: 'current' } }); assert.equal(await task.promise, 'current'); assert(worker.stopped);
  const cancelledWorker = make(), cancelled = createLayoutTask(() => cancelledWorker, {}, {});
  const rejection = assert.rejects(cancelled.promise, error => error.code === 'LAYOUT_CANCELLED'); cancelled.cancel(); await rejection; assert(cancelledWorker.stopped);
  const timed = createLayoutTask(make, {}, {}, { timeoutMs: 5 }); await assert.rejects(timed.promise, /超时/);
  const failedWorker = make(), failed = createLayoutTask(() => failedWorker, {}, {});
  failedWorker.onerror({ message: 'fixture failure' }); await assert.rejects(failed.promise, /fixture/); assert(failedWorker.stopped);
});

test('command catalogue is unique, menus reference it, and read-only actions cannot mutate', async () => {
  const { commandCatalogue, commandEnabled, menuSections, paletteResults } = await import('../renderer/command-catalogue.mjs');
  const ids = new Set(commandCatalogue.map(command => command.id)); assert.equal(ids.size, commandCatalogue.length);
  for (const section of menuSections) for (const id of section.ids) assert(ids.has(id));
  for (const command of commandCatalogue.filter(value => value.mutating)) assert.equal(commandEnabled(command, { readOnly: true }), false);
  const model = { tables: [{ id: 'orders', name: 'orders', fields: [{ id: 'status', name: 'status', reviewChineseName: '订单状态' }] }] };
  const before = JSON.stringify(model);
  const match = paletteResults(model, commandCatalogue, 'orders status').find(result => result.kind === 'table');
  assert.equal(match.fieldId, 'status'); assert.equal(match.tableId, 'orders');
  assert(paletteResults(model, commandCatalogue, 'settings').some(result => result.id === 'app.settings'));
  assert(paletteResults(model, commandCatalogue, '>').every(result => result.kind === 'command'));
  assert.equal(JSON.stringify(model), before);
});

test('directory collapse is a backward-compatible reading preference and focus preserves aspect ratio', async () => {
  const { normalizeReadingState } = await import('../eda/reading-state.mjs');
  const { focusNodeView } = await import('../eda/camera.mjs');
  assert.deepEqual(normalizeReadingState({}).collapsedDomains, []);
  assert.deepEqual(normalizeReadingState({ collapsedDomains: ['a', 'a', {}, 'b'] }).collapsedDomains, ['a', 'b']);
  const view = focusNodeView({ x: 500, y: 600, width: 360, height: 280 }, { width: 1200, height: 800 });
  assert.equal(view[2] / view[3], 1.5); assert.equal(view[0] + view[2] / 2, 680); assert.equal(view[1] + view[3] / 2, 740);
  assert.equal(focusNodeView(null), null);
});

test('build boundaries normalize Windows paths without copying dependency or release trees', async () => {
  const { excludedPackageSource, modulePath } = await import('../build/paths.mjs');
  const { rendererAliases } = await import('../build/aliases.mjs');
  for (const source of ['desktop/node_modules/pkg', 'desktop\\node_modules\\pkg', 'desktop\\release\\old.app', '.git\\config']) assert(excludedPackageSource(source));
  assert(!excludedPackageSource('desktop\\renderer\\commands.js'));
  assert.equal(modulePath('C:\\repo\\desktop\\app.jsx?jsx'), 'C:/repo/desktop/app.jsx');
  const aliases = rendererAliases('C:\\repo\\desktop', 'C:\\repo\\work\\drawdb');
  assert.equal(aliases['@drawdb'], 'C:/repo/work/drawdb/src');
});
