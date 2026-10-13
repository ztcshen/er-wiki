import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { conditionalModel } from '../desktop/test/fixtures/conditional-model.mjs';
import { canonicalModelContent } from '../desktop/renderer/model-content.mjs';

// Exercise renderer commands and stored preferences in a disposable fictional
// profile. No mouse, keyboard, synthesized DOM clicks or real user data.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'desktop/package.json'));
const { _electron } = await import(process.env.ER_WIKI_PLAYWRIGHT_MODULE || 'playwright');
const version = JSON.parse(await fs.readFile(path.join(root, 'desktop/package.json'), 'utf8')).version;
const output = path.resolve(process.env.ER_WIKI_SMOKE_OUTPUT || await fs.mkdtemp(path.join(root, 'work/engineering-workbench-')));
await fs.mkdir(output, { recursive: true });
const profile = await fs.mkdtemp(path.join(root, 'work/engineering-workbench-profile-'));
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
  document.querySelector('.eda-workspace')?.dataset.readingSettled === 'true', null, { timeout: 90000 });
const command = (action, extra = {}) => page.evaluate(({ action, extra }) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Workspace command timed out: ${action}`)), 60000);
  window.dispatchEvent(new CustomEvent('erwiki-command', { detail: { action, ...extra,
    resolve: result => { clearTimeout(timeout); resolve(result); } } }));
}), { action, extra });
const eda = (action, extra = {}, response = false) => page.evaluate(({ action, extra, response }) => {
  if (!response) return window.dispatchEvent(new CustomEvent('erwiki-eda-command', { detail: { action, ...extra } }));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Diagram command timed out: ${action}`)), 20000);
    window.dispatchEvent(new CustomEvent('erwiki-eda-command', { detail: { action, ...extra,
      resolve: result => { clearTimeout(timeout); resolve(result); } } }));
  });
}, { action, extra, response });
const read = async () => {
  const result = await command('read-current'); assert.equal(result.ok, true, result.error);
  return { ...result, model: JSON.parse(result.json) };
};
const savedSettings = () => page.evaluate(() => JSON.parse(localStorage.getItem('settings') || '{}'));
const display = async options => {
  assert.deepEqual(await eda('set-display-options', { options }, true), options);
  await page.waitForFunction(options => {
    const saved = JSON.parse(localStorage.getItem('settings') || '{}');
    return Object.entries(options).every(([key, value]) => saved[key] === value);
  }, options);
};
const wireGeometry = () => page.evaluate(() => [...document.querySelectorAll('.eda-canvas [data-eda-wire]')]
  .map(element => ({ id: element.dataset.edaWire, paths: [...element.querySelectorAll('path.eda-wire')].map(path => path.getAttribute('d')) }))
  .sort((a, b) => a.id.localeCompare(b.id)));
const opacities = () => page.evaluate(() => [...document.querySelectorAll('.eda-canvas [data-eda-wire], .eda-canvas [data-node-kind="table"]')]
  .map(element => ({ id: element.dataset.edaWire || element.dataset.edaNode, opacity: Number(getComputedStyle(element).opacity) })));
const bounds = () => page.evaluate(() => {
  const rect = selector => {
    const element = document.querySelector(selector), box = element?.getBoundingClientRect();
    return box ? { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom,
      display: getComputedStyle(element).display } : null;
  };
  return { viewport: { width: innerWidth, height: innerHeight }, pageWidth: document.documentElement.scrollWidth,
    canvas: rect('.eda-canvas'), dock: rect('.reading-context-pane'), status: rect('.engineering-statusbar'),
    header: rect('.desktop-header'), headerActions: rect('.desktop-header-actions'),
    tabs: rect('.diagram-document-tabs'), fallback: rect('.diagram-view-select') };
});
const assertInside = (rectangle, viewport, label) => {
  assert(rectangle && rectangle.display !== 'none' && rectangle.width > 0 && rectangle.height > 0, `${label} must be visible`);
  assert(rectangle.x >= -2 && rectangle.y >= -2 && rectangle.right <= viewport.width + 2 && rectangle.bottom <= viewport.height + 2,
    `${label} must stay within the viewport: ${JSON.stringify(rectangle)}`);
};
const saveScreenshot = async name => {
  await page.waitForFunction(() => [...document.querySelectorAll('.semi-toast')].every(element => {
    const style = getComputedStyle(element), rectangle = element.getBoundingClientRect();
    return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || !rectangle.width || !rectangle.height;
  }));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.screenshot({ path: path.join(output, name) });
};
const selectView = async (id, count, name) => {
  await eda('select-reading-view', { id });
  await page.waitForFunction(({ id, count }) => document.querySelector('.eda-workspace')?.dataset.edaView === id &&
    document.querySelectorAll('.eda-canvas [data-node-kind="table"]').length === count, { id, count });
  await ready();
  assert.equal(await page.locator('.diagram-document-tab[aria-selected="true"]').innerText(), name);
};
const flushReading = () => page.evaluate(() => window.dispatchEvent(new Event('pagehide')));

try {
  await ready();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 1000));
  await page.evaluate(async () => {
    await window.erDesktop.setPreferences({ language: 'zh' });
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    localStorage.setItem('settings', JSON.stringify({ ...settings, mode: 'light', edaSemanticZoom: false }));
  });
  await page.reload(); await ready();
  const targetId = await page.locator('.eda-workspace').getAttribute('data-eda-model'), fixture = conditionalModel();
  fixture.title = 'Engineering workbench · Fictional model';
  fixture.diagramViews = [
    { id: 'smoke:all', name: '完整业务', depicts: fixture.tables.map(table => ({ tableId: table.id })) },
    { id: 'smoke:repayments', name: '还款关系', description: 'Fictional loan and repayment review', depicts: ['loans', 'repayments'].map(tableId => ({ tableId })) },
  ];
  const replaced = await command('replace-json', { targetId, json: JSON.stringify(fixture) });
  assert.equal(replaced.ok, true, replaced.error); await ready();
  await display({ edaGrid: true, edaPortMarkers: true, edaRelationLabels: true, edaDimOthers: true, edaSemanticZoom: false });
  await eda('set-reading-layout', { direction: 'horizontal', context: 'details', directoryVisible: true });
  await eda('show-properties');
  await page.waitForSelector('.document-properties');
  const baseline = await read(), canonical = canonicalModelContent(baseline.model);
  assert.equal(baseline.hasUnsavedChanges, false);
  assert.equal(baseline.model.tables.length, 5); assert.equal(baseline.model.diagramViews.length, 2);
  assert.equal(await page.locator('.diagram-document-tab').count(), 3);
  assert.equal(await page.locator('.diagram-document-tab[aria-selected="true"]').innerText(), '完整模型');
  await eda('fit');
  const desktopBounds = await bounds();
  assertInside(desktopBounds.canvas, desktopBounds.viewport, 'Desktop canvas');
  assertInside(desktopBounds.dock, desktopBounds.viewport, 'Desktop property dock');
  assertInside(desktopBounds.status, desktopBounds.viewport, 'Desktop status bar');
  assert(desktopBounds.canvas.y <= 140, `Chrome consumes excessive height: ${desktopBounds.canvas.y}`);
  assert(desktopBounds.canvas.height >= desktopBounds.viewport.height * 0.7, 'Desktop canvas must retain at least 70% of viewport height');
  await saveScreenshot('engineering-overview.png');

  await selectView('smoke:all', 5, '完整业务');
  await selectView('smoke:repayments', 2, '还款关系');
  assert.deepEqual(await page.locator('.eda-canvas [data-node-kind="table"]').evaluateAll(elements => elements.map(element => element.dataset.tableId).sort()), ['loans', 'repayments']);
  const subsetGeometry = await wireGeometry();
  await eda('focus-table', { tableId: 'loans' }); await ready();
  await page.waitForSelector('.eda-inspector');
  assert.equal(await page.locator('.eda-workspace').getAttribute('data-eda-view'), 'smoke:repayments', 'Cross-probing a projected table must retain the named view');
  assert.equal(await page.locator('.eda-canvas [data-node-kind="table"]').count(), 2);
  assert.deepEqual(await wireGeometry(), subsetGeometry, 'Cross-probing must preserve the current view routing');
  await eda('clear-focus'); await page.waitForSelector('.document-properties');
  await selectView('', 5, '完整模型');
  assert.equal(canonicalModelContent((await read()).model), canonical, 'Switching document tabs must not mutate the model');

  const beforeDisplay = await wireGeometry(); assert(beforeDisplay.length > 0);
  await eda('focus-table', { tableId: 'repayments', fieldId: 'repayments.loan_id' }); await ready();
  await page.waitForSelector('[data-eda-field-details]');
  assert.equal(await page.locator('[data-eda-field-details] h3').innerText(), 'loan_id');
  assert.equal(await page.locator('[data-eda-field-details] .eda-context-back').innerText(), 'repayments');
  await page.waitForFunction(() => [...document.querySelectorAll('.eda-canvas [data-eda-wire]')].some(element => Number(getComputedStyle(element).opacity) < 1));
  const dimmed = await opacities(); assert(dimmed.some(item => item.opacity < 1));
  await saveScreenshot('engineering-properties.png');
  await display({ edaDimOthers: false });
  assert((await opacities()).every(item => item.opacity === 1), 'Disabling dimming must actually restore object opacity');
  assert.deepEqual(await wireGeometry(), beforeDisplay, 'Focus and dimming must preserve routed world coordinates');
  await display({ edaDimOthers: true });
  assert((await opacities()).some(item => item.opacity < 1));
  await eda('clear-focus'); await page.waitForSelector('.document-properties');
  assert((await opacities()).every(item => item.opacity === 1), 'Clearing focus must restore full opacity');
  await eda('fit');

  await eda('show-view-configuration'); await page.waitForSelector('.eda-display-panel.is-docked');
  assert.equal(await page.locator('.reading-context-tabs [aria-selected="true"]').innerText(), '显示');
  assert(await page.locator('.eda-canvas [data-diagram-grid]').count() > 0);
  assert(await page.locator('.eda-canvas [data-eda-port]').count() > 0);
  assert(await page.locator('.eda-canvas [data-eda-condition]').count() > 0);
  const hiddenOptions = { edaGrid: false, edaPortMarkers: false, edaRelationLabels: false };
  await display(hiddenOptions);
  for (const selector of ['[data-diagram-grid]', '[data-eda-port]', '[data-eda-condition]'])
    assert.equal(await page.locator(`.eda-canvas ${selector}`).count(), 0, `${selector} must respond to its display setting`);
  assert.deepEqual(await wireGeometry(), beforeDisplay, 'Hiding grid, ports and captions must not move wires');
  assert.equal(canonicalModelContent((await read()).model), canonical, 'Display changes must not mutate canonical model JSON');
  await flushReading(); await page.reload(); await ready();
  await page.waitForSelector('.eda-display-panel.is-docked');
  const persisted = await savedSettings();
  for (const [key, value] of Object.entries(hiddenOptions)) {
    assert.equal(persisted[key], value); assert.equal(await page.locator(`[data-display-setting="${key}"]`).isChecked(), value);
  }
  for (const selector of ['[data-diagram-grid]', '[data-eda-port]', '[data-eda-condition]'])
    assert.equal(await page.locator(`.eda-canvas ${selector}`).count(), 0, `${selector} must remain hidden after reload`);
  assert.deepEqual(await wireGeometry(), beforeDisplay, 'Reloaded presentation settings must preserve wire geometry');
  assert.equal(canonicalModelContent((await read()).model), canonical);
  assert.equal((await read()).hasUnsavedChanges, false, 'Presentation choices must not mark the model dirty');
  await saveScreenshot('engineering-display.png');

  const lightCanvas = await page.locator('.eda-canvas').evaluate(element => getComputedStyle(element).backgroundColor);
  await display({ edaGrid: true, edaPortMarkers: true, edaRelationLabels: true });
  await page.evaluate(() => {
    // SettingsContext reads and persists this ordinary application preference.
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    localStorage.setItem('settings', JSON.stringify({ ...settings, mode: 'dark' }));
  });
  await flushReading(); await page.reload(); await ready();
  await page.waitForFunction(() => document.body.getAttribute('theme-mode') === 'dark');
  await eda('show-properties'); await page.waitForSelector('.document-properties'); await eda('fit');
  const darkCanvas = await page.locator('.eda-canvas').evaluate(element => getComputedStyle(element).backgroundColor);
  assert.notEqual(darkCanvas, lightCanvas, 'Dark preference must change the actual canvas appearance');
  assert.deepEqual(await wireGeometry(), beforeDisplay);
  await saveScreenshot('engineering-dark.png');

  await page.evaluate(() => window.erDesktop.setPreferences({ language: 'en' }));
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.setMinimumSize(500, 500);
    window.setContentSize(700, 900);
  });
  await flushReading(); await page.reload(); await ready();
  await eda('set-reading-layout', { direction: 'vertical', context: 'display', directoryVisible: false });
  await page.waitForFunction(() => document.documentElement.lang === 'en' &&
    document.querySelector('.eda-body')?.dataset.splitDirection === 'vertical' && document.querySelector('.eda-display-panel.is-docked'));
  await eda('fit');
  const narrowBounds = await bounds();
  assert.equal(narrowBounds.viewport.width, 700, 'The isolated test window must actually enter the narrow CSS breakpoint');
  assertInside(narrowBounds.canvas, narrowBounds.viewport, 'Narrow canvas');
  assertInside(narrowBounds.dock, narrowBounds.viewport, 'Narrow display dock');
  assertInside(narrowBounds.status, narrowBounds.viewport, 'Narrow status bar');
  assertInside(narrowBounds.header, narrowBounds.viewport, 'Narrow header');
  assertInside(narrowBounds.headerActions, narrowBounds.viewport, 'Narrow header actions');
  assert(narrowBounds.headerActions.y >= narrowBounds.header.y - 2 && narrowBounds.headerActions.bottom <= narrowBounds.header.bottom + 2,
    'Narrow header actions must not wrap below the header');
  assert(narrowBounds.pageWidth <= narrowBounds.viewport.width + 2, 'Narrow viewport must not have horizontal page overflow');
  assert(narrowBounds.dock.y >= narrowBounds.canvas.bottom - 2, 'Vertical dock must sit below the canvas');
  assert(narrowBounds.canvas.width >= narrowBounds.viewport.width - 4, 'Hiding the directory must leave the narrow canvas full width');
  assert.equal(narrowBounds.tabs.display, 'none'); assertInside(narrowBounds.fallback, narrowBounds.viewport, 'Narrow view selector');
  assert.equal(await page.locator('.reading-context-tabs [aria-selected="true"]').getAttribute('aria-label'), 'Diagram display settings');
  assert.equal(canonicalModelContent((await read()).model), canonical);
  await saveScreenshot('engineering-narrow-english.png');
  assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
  await fs.writeFile(path.join(output, 'smoke-result.json'), JSON.stringify({ passed: true, version, packaged, profile,
    checks: ['fictional model with two named diagram views', 'document tabs switch projected scope without changing shared definitions',
      'table cross-probing preserves named view and routing', 'document and selected-field properties', 'dimming changes actual SVG opacity', 'clear focus restores document properties',
      'grid, port and caption visibility controls', 'stored settings and dock restored after reload', 'wire coordinates stay unchanged',
      'canonical model JSON and clean save status remain unchanged', 'compact desktop chrome and in-viewport status bar',
      'light and dark preference rendering', 'English narrow viewport with vertical dock and no horizontal overflow', 'no renderer or console errors'],
    tables: baseline.model.tables.length, relationships: baseline.model.relationships.length,
    diagramViews: baseline.model.diagramViews.map(view => ({ id: view.id, tables: view.depicts.length })),
    desktopBounds, narrowBounds, canvasColors: { light: lightCanvas, dark: darkCanvas }, displayOptionsAfterReload: persisted,
    wireGeometry: beforeDisplay, dimmedObjects: dimmed.filter(item => item.opacity < 1), pageErrors: errors, consoleErrors,
    interaction: 'programmatic renderer commands and stored preferences; no mouse or keyboard', humanGuiAcceptance: false }, null, 2));
  console.log('PASS: engineering tabs, properties, display persistence, geometry invariance and responsive themes. ' + output);
} catch (error) {
  await saveScreenshot('failure.png').catch(() => {});
  await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: error.stack, errors, consoleErrors,
    bounds: await bounds().catch(() => null) }, null, 2)).catch(() => {});
  console.error(JSON.stringify({ output, errors, consoleErrors, body: (await page.locator('body').innerText().catch(() => '')).slice(0, 5000) }));
  throw error;
} finally { await app.close(); }
