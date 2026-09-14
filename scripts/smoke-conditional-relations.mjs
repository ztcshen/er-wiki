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
assert(conditions.length > 0, 'This focused scenario needs conditional business references');
const profile = path.join(out, 'profile');
if (process.env.ER_WIKI_TEST_LANGUAGE) {
  assert(['zh', 'en'].includes(process.env.ER_WIKI_TEST_LANGUAGE));
  await fs.mkdir(profile, { recursive: true });
  await fs.writeFile(path.join(profile, 'preferences.json'), JSON.stringify({ language: process.env.ER_WIKI_TEST_LANGUAGE }));
}
const app = await _electron.launch({
  executablePath: process.env.ER_WIKI_TEST_APP || require('electron'),
  args: process.env.ER_WIKI_TEST_APP ? [] : [path.join(root, 'desktop/main.cjs')],
  env: { ...process.env, ER_WIKI_TEST_PROFILE: profile },
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
    assert.equal(await page.locator('[data-kind="conditional"]').count(), conditions.length);
    assert.equal(await page.locator('[data-eda-condition]').count(), conditions.length);
    const boxes = await page.locator('[data-node-kind="table"]').evaluateAll(nodes => Object.fromEntries(nodes.map(n => {
      const rect = n.getBoundingClientRect();
      return [n.getAttribute('data-table-id'), { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }];
    })));
    for (const table of document.tables.filter(t => t.reviewPlacement)) {
      const node = boxes[table.id], anchor = boxes[table.reviewPlacement.belowTableId];
      assert(node.y > anchor.bottom, 'Placed table must remain below its anchor after reload');
      if (table.reviewPlacement.leftOfTableId) assert(node.right < boxes[table.reviewPlacement.leftOfTableId].x, 'Placed table must stay left of the requested business table');
    }
    const sourceIds = [...new Set(conditions.map(r => r.startTableId))];
    for (const id of sourceIds) {
      const badges = page.locator('[data-cardinality-table]').filter({ has: page.locator('text') });
      const matching = await badges.evaluateAll((nodes, id) => nodes.filter(n => n.getAttribute('data-cardinality-table') === id).length, id);
      assert(matching >= 1 && matching <= 2, 'Shared field has at most one badge per side');
    }
    for (const relation of conditions) {
      const wires = page.locator('[data-kind="conditional"]');
      const ids = await wires.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-rel-ids')));
      const index = ids.indexOf(JSON.stringify([relation.id]));
      assert(index >= 0, 'Each original relation must have its own wire');
      const wire = wires.nth(index);
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
  console.log(JSON.stringify({ passed: true, out, tables: document.tables.length, directConditions: conditions.length, checked: ['Bus enabled', 'all lines', 'all net labels', 'same model after reload', 'visible condition labels', 'no page errors'] }));
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  console.error(JSON.stringify({ out, errors }));
  throw error;
} finally {
  await app.close();
}
