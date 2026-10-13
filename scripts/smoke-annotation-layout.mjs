import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { conditionalModel } from '../desktop/test/fixtures/conditional-model.mjs';
import { restoreLayoutSnapshot } from '../desktop/eda/layout-snapshot.mjs';
import { cardinalityBadges, bundleBadges } from '../desktop/eda/cardinality.mjs';
import { scopeKey } from '../desktop/eda/reading-state.mjs';

// Use renderer commands and a disposable fictional profile. No mouse, keyboard,
// DOM clicks or real model database are involved in this smoke test.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'desktop/package.json'));
const { _electron } = await import(process.env.ER_WIKI_PLAYWRIGHT_MODULE || 'playwright');
const version = JSON.parse(await fs.readFile(path.join(root, 'desktop/package.json'), 'utf8')).version;
const output = path.resolve(process.env.ER_WIKI_SMOKE_OUTPUT || await fs.mkdtemp(path.join(root, 'work/annotation-layout-')));
await fs.mkdir(output, { recursive: true });
const profile = await fs.mkdtemp(path.join(root, 'work/annotation-layout-profile-'));
const packaged = process.argv.includes('--packaged');
const executable = packaged
  ? path.join(root, 'desktop/release', version, 'ER Wiki Community-darwin-arm64/ER Wiki Community.app/Contents/MacOS/ER Wiki Community')
  : require('electron');
const app = await _electron.launch({ executablePath: executable, args: packaged ? [] : [path.join(root, 'desktop/main.cjs')],
  env: { ...process.env, ER_WIKI_TEST_PROFILE: profile } });
const page = await app.firstWindow(), errors = [], consoleErrors = [];
page.setDefaultTimeout(20000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
const ready = () => page.waitForFunction(() => document.querySelector('[data-eda-ready="true"]') &&
  document.querySelector('.eda-workspace')?.dataset.readingSettled === 'true', null, { timeout: 60000 });
const command = (action, extra = {}) => page.evaluate(({ action, extra }) => new Promise(resolve => {
  window.dispatchEvent(new CustomEvent('erwiki-command', { detail: { action, ...extra, resolve } }));
}), { action, extra });
const eda = action => page.evaluate(action => window.dispatchEvent(new CustomEvent('erwiki-eda-command', { detail: { action } })), action);
const readModel = async () => {
  const result = await command('read-current');
  assert.equal(result.ok, true, result.error);
  return JSON.parse(result.json);
};
const readCache = async targetId => {
  const state = await page.evaluate(targetId => JSON.parse(localStorage.getItem(`erwiki.reader.v1.${encodeURIComponent(targetId)}`)), targetId);
  const key = JSON.stringify([targetId, scopeKey(state.location)]);
  const cached = await page.evaluate(key => new Promise((resolve, reject) => {
    const request = indexedDB.open('erwiki-layout-cache');
    request.onupgradeneeded = () => { request.transaction.abort(); reject(new Error('No persisted layout cache database')); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('layouts') || !db.objectStoreNames.contains('contents')) {
        db.close(); reject(new Error('Layout cache stores are missing')); return;
      }
      const transaction = db.transaction(['layouts', 'contents']);
      transaction.onerror = () => { db.close(); reject(transaction.error); };
      const reference = transaction.objectStore('layouts').get(key);
      reference.onsuccess = () => {
        if (!reference.result) { db.close(); resolve(null); return; }
        const content = transaction.objectStore('contents').get(reference.result.contentKey);
        content.onsuccess = () => { db.close(); resolve({ reference: reference.result, content: content.result }); };
      };
    };
  }), key);
  assert(cached?.content?.data, 'The final annotation layout must be saved in the actual layout cache');
  return { state, ...cached, snapshot: JSON.parse(cached.content.data) };
};
const number = value => Math.round(Number(value) * 1e6) / 1e6;
const ordered = values => values.sort((a, b) => a.key.localeCompare(b.key));
const renderedGeometry = () => page.evaluate(() => {
  const round = value => Math.round(Number(value) * 1e6) / 1e6;
  const position = element => {
    const transform = element.transform.baseVal.consolidate().matrix;
    return { x: round(transform.e), y: round(transform.f) };
  };
  const size = element => {
    const rect = element.querySelector('rect');
    return { width: round(rect.width.baseVal.value), height: round(rect.height.baseVal.value) };
  };
  const sorted = values => values.sort((a, b) => a.key.localeCompare(b.key));
  return {
    cardinality: sorted([...document.querySelectorAll('[data-eda-cardinality]')].map(element => ({
      key: JSON.stringify([element.dataset.cardinalityTable, element.dataset.portSide, JSON.parse(element.dataset.relIds)]),
      value: element.dataset.edaCardinality, ...position(element), ...size(element),
    }))),
    bundles: sorted([...document.querySelectorAll('[data-bundle-count]')].map(element => ({
      key: element.dataset.relIds, count: Number(element.dataset.bundleCount), ...position(element), ...size(element),
    }))),
    conditions: sorted([...document.querySelectorAll('[data-eda-condition]')].map(element => ({
      key: JSON.stringify([element.closest('[data-eda-wire]').dataset.edaWire, element.dataset.edaCondition]),
      ...position(element), ...size(element),
    }))),
  };
});
const expectedGeometry = (snapshot, model, location) => {
  const result = restoreLayoutSnapshot(snapshot, { ...model, groups: model.reviewGroups || [] }, location);
  const dimensions = badge => ({ x: number(badge.x), y: number(badge.y), width: number(badge.width), height: number(badge.height) });
  return {
    cardinality: ordered(cardinalityBadges(result).map(badge => ({
      key: JSON.stringify([String(badge.tableId), badge.side, badge.refs]), value: badge.value, ...dimensions(badge),
    }))),
    bundles: ordered(bundleBadges(result).map(badge => ({
      key: JSON.stringify(badge.refs), count: badge.count, ...dimensions({ ...badge, width: 64, height: 16 }),
    }))),
    conditions: ordered(result.layout.edges.flatMap(edge => (edge.labels || []).map(label => ({
      key: JSON.stringify([edge.id, label.text]), ...dimensions(label),
    })))),
  };
};

try {
  await ready();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 1000));
  const targetId = page.url().split('/').at(-1), fixture = conditionalModel();
  const replaced = await command('replace-json', { targetId, json: JSON.stringify(fixture) });
  assert.equal(replaced.ok, true, replaced.error);
  await ready();
  const original = await readModel();
  assert.equal(original.tables.length, fixture.tables.length);
  assert.equal(original.relationships.length, fixture.relationships.length);
  // Turn presentation choices into stored preferences, then reload through the
  // ordinary application bootstrap rather than synthesizing UI input.
  await page.evaluate(targetId => {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    localStorage.setItem('settings', JSON.stringify({ ...settings, edaCardinality: true, edaSemanticZoom: false }));
    const key = `erwiki.reader.v1.${encodeURIComponent(targetId)}`;
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...state, location: { level: 'overview', labels: 'off', bundle: true }, views: {} }));
  }, targetId);
  await page.reload(); await ready();
  await eda('fit');
  const cached = await readCache(targetId), beforeReload = await renderedGeometry();
  assert(cached.snapshot.layout.annotationPositions?.cardinality.length > 0, 'Cardinality placement must be persisted');
  assert(cached.snapshot.layout.annotationPositions?.bundles.length > 0, 'Bundle placement must be persisted');
  assert(beforeReload.cardinality.length > 0);
  assert.equal(beforeReload.bundles.length, 1, 'The shared loan references must keep their bundle');
  assert.equal(beforeReload.conditions.length, 3, 'Every conditional reference must retain a condition label');
  assert.deepEqual(beforeReload, expectedGeometry(cached.snapshot, original, cached.state.location), 'Rendered annotation positions must use cached geometry');
  for (const metric of ['labelOverlaps', 'badgeOverlaps', 'annotationIntrusions'])
    assert.equal(cached.snapshot.quality[metric], 0, `Unexpected annotation conflict: ${metric}`);
  assert.deepEqual(await readModel(), original, 'Annotation placement must preserve every model field and relationship');

  await page.reload(); await ready();
  assert.equal(await page.locator('[data-eda-ready="true"]').getAttribute('data-layout-source'), 'cache');
  const restored = await readCache(targetId), afterReload = await renderedGeometry();
  assert.equal(restored.content.checksum, cached.content.checksum, 'Reload must read the existing cache record');
  assert.deepEqual(afterReload, beforeReload, 'All annotation geometry must survive a renderer restart');
  assert.deepEqual(await readModel(), original, 'Reload must preserve the unchanged model');
  await eda('fit');
  await page.screenshot({ path: path.join(output, 'annotation-layout.png') });
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  await fs.writeFile(path.join(output, 'smoke-result.json'), JSON.stringify({ passed: true, version, packaged, profile,
    checks: ['fictional conditional model', 'cardinality and bundle annotation persistence', 'rendered SVG matches cached world coordinates',
      'zero annotation conflicts', 'actual cache hit after renderer reload', 'unchanged model semantics', 'no page or console errors'],
    counts: { tables: original.tables.length, relationships: original.relationships.length,
      cardinality: beforeReload.cardinality.length, conditions: beforeReload.conditions.length, bundles: beforeReload.bundles.length },
    cacheChecksum: cached.content.checksum, geometry: beforeReload, quality: cached.snapshot.quality,
    pageErrors: errors, consoleErrors, interaction: 'programmatic renderer commands; no mouse or keyboard', humanGuiAcceptance: false }, null, 2));
  console.log('PASS: annotation rendering, semantic invariance and persistent cache restore. ' + output);
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  console.error(JSON.stringify({ output, errors, consoleErrors, body: (await page.locator('body').innerText().catch(() => '')).slice(0, 5000) }));
  throw error;
} finally { await app.close(); }
