import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Exercise renderer commands and persistence in a disposable fictional profile.
// This test deliberately uses no mouse, keyboard or synthesized DOM clicks.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'desktop/package.json'));
const { _electron } = await import(process.env.ER_WIKI_PLAYWRIGHT_MODULE || 'playwright');
const version = JSON.parse(await fs.readFile(path.join(root, 'desktop/package.json'), 'utf8')).version;
const output = path.resolve(process.env.ER_WIKI_SMOKE_OUTPUT || await fs.mkdtemp(path.join(root, 'work/reading-workbench-')));
await fs.mkdir(output, { recursive: true });
const profile = await fs.mkdtemp(path.join(root, 'work/reading-workbench-profile-'));
const packaged = process.argv.includes('--packaged');
const executable = packaged
  ? path.join(root, 'desktop/release', version, 'ER Wiki Community-darwin-arm64/ER Wiki Community.app/Contents/MacOS/ER Wiki Community')
  : require('electron');
const app = await _electron.launch({ executablePath: executable, args: packaged ? [] : [path.join(root, 'desktop/main.cjs')], env: { ...process.env, ER_WIKI_TEST_PROFILE: profile } });
const page = await app.firstWindow(), errors = [], workers = [];
page.setDefaultTimeout(20000);
page.on('pageerror', error => errors.push(error.message));
page.on('worker', worker => workers.push(worker.url()));
const settled = () => page.waitForFunction(() => document.querySelector('.eda-workspace')?.dataset.readingSettled === 'true', null, { timeout: 60000 });
const workspaceCommand = (action, extra = {}) => page.evaluate(({ action, extra }) => new Promise(resolve => {
  window.dispatchEvent(new CustomEvent('erwiki-command', { detail: { action, ...extra, resolve } }));
}), { action, extra });
const edaCommand = (action, extra = {}, response = false) => page.evaluate(({ action, extra, response }) => {
  if (response) return new Promise(resolve => window.dispatchEvent(new CustomEvent('erwiki-eda-command', { detail: { action, ...extra, resolve } })));
  window.dispatchEvent(new CustomEvent('erwiki-eda-command', { detail: { action, ...extra } }));
}, { action, extra, response });
const read = async () => { const result = await workspaceCommand('read-current'); assert.equal(result.ok, true, result.error); return { ...result, model: JSON.parse(result.json) }; };
const savedRecord = () => page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('drawDB'); open.onerror = () => reject(open.error);
  open.onsuccess = () => { const db = open.result, request = db.transaction('diagrams').objectStore('diagrams').getAll();
    request.onerror = () => { db.close(); reject(request.error); };
    request.onsuccess = () => { db.close(); resolve(request.result.find(model => model.diagramId === 'demo-fulfillment')); };
  };
}));
const readingState = () => page.evaluate(() => JSON.parse(localStorage.getItem('erwiki.reader.v1.demo-fulfillment')));
const waitState = predicate => page.waitForFunction(predicate);

try {
  await settled();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 1000));
  await page.evaluate(() => window.erDesktop.setPreferences({ language: 'zh' }));
  await page.reload(); await settled();
  const original = await read(); assert.equal(original.model.tables.length, 13);
  const query = { id: 'smoke:status', name: '状态字段审查', target: 'fields', filters: { status: 'any', nature: 'any', documentation: 'any', groupId: null, text: 'status' } };
  assert.equal(await edaCommand('save-review-query', { query }, true), true);
  await page.waitForFunction(() => document.querySelector('.review-queries select')?.value === 'smoke:status');
  await page.waitForFunction(() => document.querySelectorAll('[data-query-result=field]').length > 0);
  const queryResults = await page.locator('[data-query-result=field]').count();
  const queried = await read(); assert.equal(queried.hasUnsavedChanges, true);
  assert.equal(queried.model.schemaVersion, 4); assert.deepEqual(queried.model.reviewQueries, [query]);
  assert.deepEqual(queried.model.tables, original.model.tables); assert.deepEqual(queried.model.relationships, original.model.relationships);
  assert.equal((await workspaceCommand('save')).ok, true);
  assert.deepEqual((await savedRecord()).reviewQueries, [query]);

  await edaCommand('focus-table', { tableId: 'orders', fieldId: 'orders.id' }); await settled();
  await edaCommand('set-reading-layout', { direction: 'vertical', context: 'references', directoryVisible: false });
  await waitState(() => document.querySelector('.eda-body')?.dataset.splitDirection === 'vertical' && document.querySelector('.object-references'));
  await page.waitForFunction(() => document.querySelectorAll('[data-reference-id]').length > 0);
  const references = await page.locator('[data-reference-id]').count();
  // Flush queued camera updates through the same workspace save operation.
  await edaCommand('zoom-in');
  const workspace = await edaCommand('save-reading-workspace', { name: '订单字段与引用' }, true);
  assert(workspace?.id); assert.equal(workspace.snapshot.location.selectedField, 'orders.id');
  assert.equal(workspace.snapshot.layout.direction, 'vertical'); assert.equal(workspace.snapshot.layout.directoryVisible, false);
  assert.deepEqual((await read()).model, queried.model); assert.equal((await read()).hasUnsavedChanges, false);
  await edaCommand('set-reading-layout', { direction: 'horizontal', context: 'queries', directoryVisible: true });
  await waitState(() => document.querySelector('.eda-body')?.dataset.splitDirection === 'horizontal');
  assert.equal(await edaCommand('load-reading-workspace', { id: workspace.id }, true), true); await settled();
  await waitState(() => document.querySelector('.eda-body')?.dataset.splitDirection === 'vertical');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('erwiki.reader.v1.demo-fulfillment') || '{}');
    return state.layout?.direction === 'vertical' && state.location?.selectedField === 'orders.id';
  });
  const beforeReload = await readingState();
  await page.reload(); await settled();
  const restored = await readingState();
  assert.equal(restored.layout.direction, 'vertical'); assert.equal(restored.location.selectedField, 'orders.id');
  assert.equal(restored.queryId, 'smoke:status');
  assert.deepEqual(restored.views, beforeReload.views);
  assert.equal(await page.locator('[data-reference-id]').count(), references);
  assert.deepEqual((await read()).model, queried.model);

  // The same workspace remains available after a full renderer restart.
  await edaCommand('overview'); await settled();
  assert.equal(await edaCommand('load-reading-workspace', { id: workspace.id }, true), true); await settled();
  await edaCommand('show-review-queries');
  await page.waitForFunction(() => document.querySelector('.review-queries select')?.value === 'smoke:status');
  assert.equal(await page.locator('[data-query-result=field]').count(), queryResults);
  await page.screenshot({ path: path.join(output, 'reading-workbench.png') });
  const exportedFile = path.join(output, 'ER-Wiki-' + version + '-demo.drawdb.json');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, exportedFile);
  assert.equal((await workspaceCommand('export')).ok, true);
  const exported = JSON.parse(await fs.readFile(exportedFile, 'utf8'));
  assert.deepEqual(exported.reviewQueries, [query]); assert.deepEqual(exported.tables, original.model.tables);
  assert.equal(Object.hasOwn(exported, 'workspaces'), false); assert.equal(Object.hasOwn(exported, 'layout'), false);

  // Switch language and exercise the narrow, stacked layout without input events.
  await page.evaluate(() => window.erDesktop.setPreferences({ language: 'en' }));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(700, 900));
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload(); await settled();
  await edaCommand('show-review-queries');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  const overflow = await page.evaluate(() => {
    const pane = document.querySelector('.reading-context-pane').getBoundingClientRect();
    const canvas = document.querySelector('.eda-canvas').getBoundingClientRect();
    return { paneWidth: pane.width, paneBottom: pane.bottom, canvasWidth: canvas.width, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  assert(overflow.paneWidth > 100 && overflow.canvasWidth > 100);
  assert(overflow.paneBottom <= overflow.viewportHeight + 2);
  assert(workers.some(url => url.includes('model-index.worker')), 'Built module worker must execute');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'smoke-result.json'), JSON.stringify({ passed: true, version, packaged, profile, checks: [
    'real bundled index worker', 'saved query persistence and export', 'shared table and relationship invariance',
    'field reference resolution', 'workspace save/load', 'reading position and split restoration',
    'joint readiness after restart', 'English translation and narrow stacked layout',
  ], queryResults, references, pageErrors: errors, interaction: 'programmatic renderer commands; no mouse or keyboard', humanGuiAcceptance: false }, null, 2));
  console.log('PASS: reading workbench persistence, shared definitions, worker, restore and export. ' + output);
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  console.error(JSON.stringify({ errors, output, body: (await page.locator('body').innerText().catch(() => '')).slice(0,5000) }));
  throw error;
} finally { await app.close(); }
