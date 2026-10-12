import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'desktop/package.json'));
const { _electron } = await import(process.env.ER_WIKI_PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve(process.env.ER_WIKI_SMOKE_OUTPUT || await fs.mkdtemp(path.join(root, 'work/multiview-')));
await fs.mkdir(output, { recursive: true });
const version = JSON.parse(await fs.readFile(path.join(root, 'desktop/package.json'), 'utf8')).version;
const executable = process.argv.includes('--packaged')
  ? path.join(root, 'desktop/release', version, 'ER Wiki Community-darwin-arm64/ER Wiki Community.app/Contents/MacOS/ER Wiki Community')
  : require('electron');
const profile = await fs.mkdtemp(path.join(root, 'work/multiview-profile-'));
const app = await _electron.launch({ executablePath: executable, args: process.argv.includes('--packaged') ? [] : [path.join(root, 'desktop/main.cjs')], env: { ...process.env, ER_WIKI_TEST_PROFILE: profile } });
const page = await app.firstWindow(), errors = [];
page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
const ready = () => page.locator('[data-eda-ready="true"]').waitFor({ timeout: 40000 });
const record = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('drawDB'); request.onerror = () => reject(request.error);
  request.onsuccess = () => { const db = request.result, read = db.transaction('diagrams').objectStore('diagrams').getAll();
    read.onsuccess = () => { db.close(); resolve(read.result.find(m => m.diagramId === 'demo-fulfillment')); }; };
}));
const waitRecord = async predicate => {
  const until = Date.now() + 15000;
  do { const value = await record(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 60)); } while (Date.now() < until);
  throw new Error('Saved model did not match expected view state');
};
const save = async () => { await page.getByRole('button', { name: '保存模型', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('.desktop-save-status')?.textContent.includes('保存中')); };
const switchView = async (id, count) => {
  await page.getByRole('combobox', { name: '阅读视图', exact: true }).selectOption(id);
  await page.waitForFunction(id => document.querySelector('.eda-workspace')?.dataset.edaView === id, id);
  await ready(); await page.waitForFunction(count => document.querySelectorAll('[data-node-kind="table"]').length === count, count);
};
try {
  await ready();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 1000));
  await page.evaluate(() => window.erDesktop.setPreferences({ language: 'zh' })); await page.reload(); await ready();
  const original = await record(); assert.equal(original.tables.length, 13); assert.equal(original.diagramViews.length, 3);
  await page.screenshot({ path: path.join(output, 'workbench-overview.png') });
  await switchView('order-fulfillment', 7);
  const rectangles = await page.locator('[data-node-kind="table"]').evaluateAll(nodes => nodes.map(n => {
    const [x, y] = n.getAttribute('transform').match(/[-\d.]+/g).map(Number), rect = n.querySelector('rect');
    return { tableId: n.dataset.tableId, x, y, width: Number(rect.getAttribute('width')), height: Number(rect.getAttribute('height')) };
  }));
  const target = rectangles.find(r => r.tableId === 'orders');
  const delta = [[24, 0], [0, 24], [-24, 0], [0, -24]].find(([dx, dy]) => target.x + dx >= 40 && target.y + dy >= 40 && !rectangles.some(r => r !== target && target.x + dx < r.x + r.width + 12 && target.x + dx + target.width + 12 > r.x && target.y + dy < r.y + r.height + 12 && target.y + dy + target.height + 12 > r.y));
  assert(delta, 'Need a non-overlapping drag destination');
  const pointer = await page.locator('[data-node-kind="table"][data-table-id="orders"]').evaluate((node, delta) => {
    const svg = node.ownerSVGElement, [x, y] = node.getAttribute('transform').match(/[-\d.]+/g).map(Number), matrix = svg.getScreenCTM();
    const a = new DOMPoint(x + 30, y + 25).matrixTransform(matrix), b = new DOMPoint(x + 30 + delta[0], y + 25 + delta[1]).matrixTransform(matrix);
    return { from: [a.x, a.y], to: [b.x, b.y] };
  }, delta);
  await page.mouse.move(...pointer.from); await page.mouse.down(); await page.mouse.move(...pointer.to, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(({ x, y }) => { const n = document.querySelector('[data-node-kind=table][data-table-id=orders]'); if (!n || document.querySelector('.eda-canvas')?.dataset.edaReady !== 'true') return false; const values = n.getAttribute('transform').match(/[-\d.]+/g).map(Number); return Math.abs(values[0]-x)<.02 && Math.abs(values[1]-y)<.02; }, { x: target.x + delta[0], y: target.y + delta[1] }, { timeout: 40000 });
  await ready(); await save();
  const moved = await waitRecord(m => m.diagramViews.find(v => v.id === 'order-fulfillment').depicts.every(d => d.x !== undefined));
  const movedView = moved.diagramViews.find(v => v.id === 'order-fulfillment');
  const movedTable = movedView.depicts.find(d => d.tableId === 'orders');
  assert(Math.abs(movedTable.x - target.x - delta[0]) < .02 && Math.abs(movedTable.y - target.y - delta[1]) < .02);
  assert.deepEqual(moved.tables, original.tables);
  assert.deepEqual(moved.diagramViews.find(v => v.id === 'order-returns'), original.diagramViews.find(v => v.id === 'order-returns'));
  await switchView('order-returns', 5); await switchView('order-fulfillment', 7); await page.reload(); await ready();
  assert.equal(await page.getByRole('combobox', { name: '阅读视图', exact: true }).inputValue(), 'order-fulfillment');
  assert.deepEqual((await record()).diagramViews.find(v => v.id === 'order-fulfillment'), movedView);
  await page.screenshot({ path: path.join(output, 'workbench-order-view.png') });
  await page.getByRole('button', { name: '新建阅读视图', exact: true }).click();
  await page.getByRole('textbox', { name: '视图名称', exact: true }).fill('订单详读');
  await page.getByRole('button', { name: '清空选择', exact: true }).click();
  for (const name of ['orders', 'order_items', 'customers']) await page.getByRole('checkbox', { name: '包含表 ' + name, exact: true }).check();
  await page.getByRole('button', { name: '保存阅读视图', exact: true }).click();
  await ready(); await page.waitForFunction(() => document.querySelectorAll('[data-node-kind="table"]').length === 3);
  await page.getByRole('button', { name: '编辑视图', exact: true }).click();
  const orderMember = page.locator('.diagram-view-member').filter({ has: page.getByRole('checkbox', { name: '包含表 orders', exact: true }) });
  await orderMember.locator('summary').click(); await orderMember.getByRole('checkbox', { name: '自定义显示字段', exact: true }).check();
  await orderMember.getByRole('checkbox', { name: '显示字段 orders.status', exact: true }).uncheck();
  await page.getByRole('button', { name: '保存阅读视图', exact: true }).click(); await ready(); await save();
  const customized = await waitRecord(m => m.diagramViews.some(v => v.name === '订单详读' && v.depicts.some(d => d.tableId === 'orders' && d.hiddenFieldIds?.includes('orders.status'))));
  assert.deepEqual(customized.tables, original.tables);
  assert.equal(await page.locator('[data-table-id="orders"] [data-eda-field="orders.status"]').count(), 0);
  await page.screenshot({ path: path.join(output, 'workbench-reading-view.png') });
  const candidateModel = { title: customized.name, database: customized.database, tables: customized.tables, relationships: customized.references, reviewGroups: customized.reviewGroups, diagramViews: customized.diagramViews, processModel: customized.processModel };
  const candidate = candidateModel.relationships[0]; candidate.reviewEvidence = { ...candidate.reviewEvidence, kind: 'inferred', status: 'candidate', description: '虚构示例：候选关联需要人工确认' };
  const applied = await page.evaluate(json => new Promise(resolve => window.dispatchEvent(new CustomEvent('erwiki-command', { detail: { action: 'replace-json', targetId: 'demo-fulfillment', json, resolve } }))), JSON.stringify(candidateModel));
  assert.equal(applied.ok, true);
  await ready(); await page.getByRole('button', { name: '候选关联', exact: true }).click();
  await page.getByRole('complementary', { name: '候选关联', exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'workbench-candidates.png') });
  await page.getByRole('button', { name: '确认为逻辑关联', exact: true }).click(); await ready(); await save();
  await waitRecord(m => m.references.find(r => r.id === candidate.id).reviewEvidence.status === 'confirmed');
  assert.deepEqual((await record()).tables, original.tables);
  await page.getByRole('button', { name: '关闭候选关联', exact: true }).click();
  await switchView('order-fulfillment', 7);
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, path.join(output, 'ER-Wiki-0.5.0-reader.html'));
  await page.getByRole('button', { name: '导出阅读器', exact: true }).click(); await page.getByRole('button', { name: '导出 HTML', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '离线阅读器已导出' }).waitFor({ timeout: 150000 });
  const html = await fs.readFile(path.join(output, 'ER-Wiki-0.5.0-reader.html'), 'utf8');
  assert(html.startsWith('<!doctype html>')); assert(html.includes('订单详读')); assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'smoke-result.json'), JSON.stringify({ passed: true, version, profile, checks: ['shared-table invariance', 'independent view geometry', 'saved positions across reload', 'view creation and field visibility', 'candidate confirmation', 'real Electron HTML export'], tables: original.tables.length, views: (await record()).diagramViews.length, pageErrors: errors }, null, 2));
  console.log('PASS: multi-view model, independent drag/reload, field visibility, candidate confirmation, real HTML export. '+output);
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  console.error(JSON.stringify({ errors, output, body: (await page.locator('body').innerText().catch(() => '')).slice(0,8000) })); throw error;
} finally { await app.close(); }
