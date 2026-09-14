import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { conditionalModel } from '../desktop/test/fixtures/conditional-model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'desktop/package.json'));
const { _electron } = await import(process.env.ER_WIKI_PLAYWRIGHT_MODULE || 'playwright');
const out = await fs.mkdtemp(path.join(process.env.ER_WIKI_TEST_OUTPUT || path.join(root, 'work'), 'conditional-'));
const document = process.env.ER_WIKI_TEST_MODEL
  ? JSON.parse(await fs.readFile(process.env.ER_WIKI_TEST_MODEL, 'utf8')) : conditionalModel();
const conditions = document.relationships.filter(r => r.reviewEvidence?.condition);
assert.equal(conditions.length, 3, 'This focused scenario checks three alternative business references');
const app = await _electron.launch({
  executablePath: process.env.ER_WIKI_TEST_APP || require('electron'),
  args: process.env.ER_WIKI_TEST_APP ? [] : [path.join(root, 'desktop/main.cjs')],
  env: { ...process.env, ER_WIKI_TEST_PROFILE: path.join(out, 'profile') },
});
const page = await app.firstWindow(), errors = [];
page.setDefaultTimeout(15000);
page.on('pageerror', e => errors.push(e.message));
const ready = () => page.locator('[data-eda-ready="true"]').waitFor({ timeout: 30000 });
try {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900));
  await ready();
  const targetId = page.url().split('/').at(-1);
  const replaced = await page.evaluate(({ json, targetId }) => new Promise(resolve => {
    window.dispatchEvent(new CustomEvent('erwiki-command', { detail: { action: 'replace-json', json, targetId, resolve } }));
  }), { json: JSON.stringify(document), targetId });
  assert.equal(replaced.ok, true, JSON.stringify(replaced));
  await ready();
  for (const labels of ['off', 'all']) {
    await page.evaluate(({ targetId, labels }) => {
      const key = `erwiki.reader.v1.${encodeURIComponent(targetId)}`;
      const state = JSON.parse(localStorage.getItem(key) || '{}');
      state.location = { level: 'overview', labels, bundle: true };
      state.views = {};
      localStorage.setItem(key, JSON.stringify(state));
    }, { targetId, labels });
    await page.reload();
    await ready();
    assert.equal(await page.locator('[data-node-kind="table"]').count(), document.tables.length);
    assert.equal(await page.locator('[data-kind="conditional"]').count(), 3);
    assert.equal(await page.locator('[data-eda-condition]').count(), 3);
    const sourceIds = [...new Set(conditions.map(r => r.startTableId))];
    for (const id of sourceIds) {
      const badges = page.locator('[data-cardinality-table]').filter({ has: page.locator('text') });
      const matching = await badges.evaluateAll((nodes, id) => nodes.filter(n => n.getAttribute('data-cardinality-table') === id).length, id);
      assert.equal(matching, 1, 'Shared notification field must not have stacked N badges');
    }
    for (const relation of conditions) {
      const wire = page.locator('[data-kind="conditional"]').filter({ hasText: `${relation.reviewEvidence.condition.field} = ${relation.reviewEvidence.condition.value}` });
      assert.equal(await wire.count(), 1);
      assert.equal(await wire.getAttribute('data-rel-ids'), JSON.stringify([relation.id]));
      assert(await wire.locator('.eda-wire').getAttribute('d'));
      const label = wire.locator('[data-eda-condition]');
      assert(await label.isVisible());
      const box = await label.boundingBox();
      assert(box && box.width > 10 && box.height > 3);
    }
    await page.screenshot({ path: path.join(out, `relations-${labels}.png`), scale: 'css' });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, out, tables: document.tables.length, directConditions: 3, checked: ['Bus enabled', 'all lines', 'all net labels', 'same model after reload', 'visible condition labels', 'no page errors'] }));
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  console.error(JSON.stringify({ out, errors }));
  throw error;
} finally {
  await app.close();
}
