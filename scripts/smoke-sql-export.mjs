import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { conditionalModel } from '../desktop/test/fixtures/conditional-model.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'desktop/package.json'));
const { _electron } = await import(process.env.ER_WIKI_PLAYWRIGHT_MODULE || 'playwright');
const output = await fs.mkdtemp(path.join(os.tmpdir(), 'er-wiki-sql-smoke-'));
const app = await _electron.launch({ executablePath: require('electron'), args: [path.join(root, 'desktop/main.cjs')],
  env: { ...process.env, ER_WIKI_TEST_PROFILE: path.join(output, 'profile') } });
const page = await app.firstWindow(), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(15000);
try {
  await page.locator('[data-eda-ready="true"]').waitFor({ timeout: 30000 });
  const model = conditionalModel(); model.relationships[0].reviewEvidence = { kind: 'physical' };
  const applied = await page.evaluate(json => new Promise(resolve => window.dispatchEvent(new CustomEvent('erwiki-command', {
    detail: { action: 'replace-json', targetId: 'demo-fulfillment', json, resolve },
  }))), JSON.stringify(model));
  assert(applied);
  await page.locator('[data-eda-ready="true"]').waitFor({ timeout: 30000 });
  const destination = path.join(output, 'model.sql');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, destination);
  await page.getByRole('button', { name: /Quick search|快速搜索/ }).click();
  await page.getByRole('combobox', { name: /Search actions or fields|搜索操作或字段/ }).fill('> export sql');
  await page.getByRole('option', { name: /Export SQL|导出 SQL/ }).click();
  await page.getByText(/Relationships omitted from physical foreign keys|未导出为物理外键的关系/).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.semi-toast-content')].some(node => {
    const rect = node.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight;
  }));
  const sql = await fs.readFile(destination, 'utf8');
  assert.equal((sql.match(/FOREIGN KEY/gi) || []).length, 1);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(output, 'sql-export.png') });
  console.log(JSON.stringify({ passed: true, scope: 'isolated desktop SQL export and omission notice', output }));
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') });
  console.error(JSON.stringify({ url: page.url(), errors, output }));
  throw error;
} finally { await app.close(); }
