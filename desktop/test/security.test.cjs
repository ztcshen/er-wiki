const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { assetPath, isAppURL, safeFilename, safeRoute, MAX_FILE_BYTES, allowsPermission } = require('../security.cjs');
const { atomicWrite, readModelFile } = require('../files.cjs');
const { installSessionPolicy } = require('../native/session.cjs');

test('protocol serves only contained local assets and editor routes', () => {
  assert.equal(assetPath('/app/dist', 'erwiki://app/editor/diagrams/test-id'), '/app/dist/index.html');
  assert.equal(assetPath('/app/dist', 'erwiki://app/assets/index.js'), '/app/dist/assets/index.js');
  for (const url of ['https://app/index.html', 'file:///etc/passwd', 'erwiki://evil/index.html',
    'erwiki://app/%2e%2e%2fsecret', 'erwiki://app/..%5csecret', 'erwiki://app/a%00b',
    'erwiki://user@app/index.html', 'erwiki://app:42/index.html', 'erwiki://app/%zz']) {
    assert.equal(assetPath('/app/dist', url), null, url);
  }
  assert.equal(isAppURL('javascript:alert(1)'), false);
});
test('routes and suggested filenames cannot inject paths or remote URLs', () => {
  assert.equal(safeRoute('/editor/diagrams/demo-fulfillment'), true);
  for (const value of ['https://evil.com', '/editor/diagrams/../x', '/editor/diagrams/a?shareId=foo', {}, null]) {
    assert.equal(safeRoute(value), false);
  }
  assert.equal(safeFilename('a/b:c'), 'a_b_c.drawdb.json');
});
test('clipboard is limited to the focused app main frame; sensitive device permissions stay denied', () => {
  const context = { focused: true, mainFrame: true, url: 'erwiki://app/editor' };
  assert.equal(allowsPermission('clipboard-read', context), true);
  for (const permission of ['media', 'geolocation', 'notifications', 'fileSystem', 'pointerLock']) {
    assert.equal(allowsPermission(permission, context), false);
  }
  for (const restriction of [{ focused: false }, { mainFrame: false }, { url: 'https://evil.invalid' }]) {
    assert.equal(allowsPermission('clipboard-read', { ...context, ...restriction }), false);
  }
});
test('session handlers deny pointer lock even when a request is attributed to the trusted main frame', async () => {
  const contents = {};
  const handlers = {};
  installSessionPolicy({
    session: { defaultSession: {
      setPermissionRequestHandler: handler => { handlers.request = handler; },
      setPermissionCheckHandler: handler => { handlers.check = handler; },
      webRequest: { onBeforeRequest: handler => { handlers.network = handler; } },
    } },
    protocol: { handle: (_scheme, handler) => { handlers.protocol = handler; } },
    net: { fetch: async () => new Response('fixture') },
    root: '/app/dist',
    getWindow: () => ({ isFocused: () => true, webContents: contents }),
  });
  for (const details of [
    { requestingUrl: 'erwiki://app/editor', isMainFrame: true },
    { requestingUrl: 'https://embedded.invalid/', isMainFrame: false },
  ]) {
    let decision;
    handlers.request(contents, 'pointerLock', allowed => { decision = allowed; }, details);
    assert.equal(decision, false);
    assert.equal(handlers.check(contents, 'pointerLock', 'erwiki://app', details), false);
  }
  const response = await handlers.protocol({ method: 'GET', url: 'erwiki://app/editor' });
  assert.match(response.headers.get('Content-Security-Policy'), /(?:^|;\s*)frame-src 'none'(?:;|$)/);
});
test('atomic export replaces only its target and supports Unicode', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'er-wiki-files-'));
  const target = path.join(dir, '模型.json');
  await atomicWrite(target, '{"title":"第一版"}');
  await atomicWrite(target, '{"title":"第二版"}');
  assert.equal(await readModelFile(target), '{"title":"第二版"}');
  assert.deepEqual(await fs.readdir(dir), ['模型.json']);
});
test('oversize imports fail and invalid export targets leave no temporary file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'er-wiki-limits-'));
  const target = path.join(dir, 'large.json');
  const file = await fs.open(target, 'w');
  await file.truncate(MAX_FILE_BYTES + 1); await file.close();
  await assert.rejects(readModelFile(target), /20 MB/);
  await assert.rejects(atomicWrite(dir, 'cannot replace a directory'));
  assert.deepEqual(await fs.readdir(dir), ['large.json']);
});
test('build adapter fails loudly when pinned source anchors drift', async () => {
  const { integrateDesktop } = await import('../integrate.mjs');
  assert.throws(() => integrateDesktop('/desktop')('changed', '/src/components/Workspace.jsx'), /anchor changed/);
});
