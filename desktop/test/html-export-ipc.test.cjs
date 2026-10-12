const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { registerDesktopIpc } = require('../native/ipc.cjs');

function context(filePath, canceled = false) {
  const handlers = new Map(), mainFrame = { url: 'erwiki://app/editor' }, webContents = { mainFrame }, window = { webContents };
  const dialogs = [];
  registerDesktopIpc({ ipcMain: { on() {}, handle: (key, fn) => handlers.set(key, fn) }, getWindow: () => window,
    dialog: { showSaveDialog: async (_window, options) => { dialogs.push(options); return { canceled, filePath }; } },
    nativeDialog: callback => callback(), tr: value => value, localized: value => value });
  return { exportAsset: handlers.get('desktop:export-asset'), event: { sender: webContents, senderFrame: mainFrame }, dialogs };
}

test('HTML export uses a user-selected target, safe filename and the existing atomic writer', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'er-wiki-html-'));
  try {
    const target = path.join(directory, '阅读器.html'), other = path.join(directory, 'unselected.html'), ctx = context(target);
    const content = '<!doctype html><html><title>订单模型</title></html>';
    await fs.writeFile(target, 'old');
    assert.equal(await ctx.exportAsset(ctx.event, { extension: 'html', name: '../订单:阅读器', content, filePath: other }), true);
    assert.equal(await fs.readFile(target, 'utf8'), content);
    assert.deepEqual(await fs.readdir(directory), ['阅读器.html']);
    assert.equal(ctx.dialogs[0].title, '导出离线阅读器');
    assert(ctx.dialogs[0].defaultPath.endsWith('.html')); assert(!ctx.dialogs[0].defaultPath.includes('/'));
    assert.deepEqual(ctx.dialogs[0].filters[0].extensions, ['html']);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('HTML export rejects remote frames, malformed content and unsupported formats before showing a save dialog', async () => {
  const ctx = context('/unused.html'), payload = { extension: 'html', name: 'reading', content: '<!doctype html><html></html>' };
  await assert.rejects(ctx.exportAsset({ ...ctx.event, senderFrame: { url: 'https://invalid.example' } }, payload), /Untrusted/);
  await assert.rejects(ctx.exportAsset(ctx.event, { ...payload, content: '<svg></svg>' }), /Invalid export content/);
  await assert.rejects(ctx.exportAsset(ctx.event, { ...payload, extension: 'exe' }), /Invalid export asset/);
  await assert.rejects(ctx.exportAsset(ctx.event, { ...payload, name: 'a'.repeat(501) }), /Invalid export asset/);
  assert.equal(ctx.dialogs.length, 0);
});

test('canceling the native HTML export leaves the existing target intact', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'er-wiki-html-cancel-'));
  try {
    const target = path.join(directory, 'reading.html'), ctx = context(target, true); await fs.writeFile(target, 'previous');
    assert.equal(await ctx.exportAsset(ctx.event, { extension: 'html', name: 'reading', content: '<!doctype html><html></html>' }), false);
    assert.equal(await fs.readFile(target, 'utf8'), 'previous'); assert.deepEqual(await fs.readdir(directory), ['reading.html']);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
