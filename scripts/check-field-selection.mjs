import assert from 'node:assert/strict';
import path from 'node:path';
import { conditionalModel } from '../desktop/test/fixtures/conditional-model.mjs';

export async function checkFieldSelection({ app, page, read, replace, out }) {
  const model = conditionalModel(), long = model.tables.find(t => t.name === 'notifications');
  model.relationships[1].cardinality = 'one_to_many';
  for (let index = long.fields.length; index < 50; index++) long.fields.push({ ...long.fields[0], id: `extra-${index}`, name: `extra_${index}`, primary: false });
  const id = page.url().split('/').at(-1);
  assert.equal((await replace(model, id)).ok, true);
  await page.locator('[data-eda-ready="true"]').waitFor({ timeout: 30000 });
  const mixed = page.locator('[data-cardinality-table="loans"][data-eda-cardinality="混合"]');
  await mixed.waitFor();
  const badgeGeometry = await mixed.evaluate(node => {
    const rect = node.querySelector('rect'); return { transform: node.getAttribute('transform'), width: rect.getAttribute('width'), height: rect.getAttribute('height') };
  });
  const badgeBox = await mixed.locator('rect').boundingBox();
  const tableBox = await page.locator('[data-node-kind="table"][data-table-id="loans"] > rect').first().boundingBox();
  assert(badgeBox.x + badgeBox.width <= tableBox.x || badgeBox.x >= tableBox.x + tableBox.width || badgeBox.y + badgeBox.height <= tableBox.y || badgeBox.y >= tableBox.y + tableBox.height);
  const repaymentEdge = page.locator('[data-eda-wire][data-rel-ids=\'["repay-loan"]\']').first();
  await repaymentEdge.dispatchEvent('pointerover');
  const focusedBadge = page.locator('[data-cardinality-table="loans"]').filter({ has: page.locator('rect[width="46"]') });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-cardinality-table="loans"]')].some(node => node.querySelector('rect')?.getAttribute('width') === '46' && node.dataset.edaCardinality === 'N'));
  assert.deepEqual(await focusedBadge.evaluate(node => ({ transform: node.getAttribute('transform'), width: node.querySelector('rect').getAttribute('width'), height: node.querySelector('rect').getAttribute('height') })), badgeGeometry);
  await repaymentEdge.dispatchEvent('pointerout');
  const focus = (tableId, fieldId) => page.evaluate(detail => window.dispatchEvent(new CustomEvent('erwiki-eda-command', { detail: { action: 'focus-table', ...detail } })), { tableId, fieldId });
  const selected = () => page.locator('[data-eda-wire][data-highlight="true"]').evaluateAll(nodes => [...new Set(nodes.flatMap(n => JSON.parse(n.dataset.relIds)))].sort());
  await page.getByRole('searchbox', { name: /Search model|搜索模型/ }).fill('extra_49');
  await page.getByRole('button', { name: /^notifications\.extra_49/ }).click();
  await page.locator('[data-eda-field="extra-49"]').waitFor();
  await page.waitForFunction(() => document.querySelector('.eda-scale-button')?.textContent.trim() === '100%');
  const row = await page.locator('[data-eda-field="extra-49"]').boundingBox();
  const canvas = await page.locator('[data-eda-scene]').boundingBox();
  assert(row.y >= canvas.y && row.y + row.height <= canvas.y + canvas.height);
  const stored = await read();
  await page.evaluate(() => {
    const Original = window.Worker; window.__fieldWorkers = 0;
    window.Worker = class extends Original { constructor(...args) { super(...args); window.__fieldWorkers++; } };
  });
  await focus('notifications', 'notifications.business_id');
  await page.waitForFunction(() => document.querySelector('[data-eda-field-details] h3')?.textContent === 'business_id');
  assert.deepEqual(await selected(), ['notice-CREDIT', 'notice-FINANCING', 'notice-REPAYMENT']);
  const camera = await page.locator('[data-eda-scene]').getAttribute('viewBox');
  await page.locator('[data-eda-field="notifications.business_id"]').click();
  assert.equal(await page.locator('[data-eda-scene]').getAttribute('viewBox'), camera);
  assert.deepEqual(await selected(), ['notice-CREDIT', 'notice-FINANCING', 'notice-REPAYMENT']);
  const edge = page.locator('[data-eda-wire]').filter({ has: page.locator('title', { hasText: 'business_type = CREDIT' }) }).first();
  // Dispatch the same pointer events without moving the camera to an offscreen edge.
  await edge.dispatchEvent('pointerover');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-eda-wire][data-highlight="true"]')].every(node => JSON.parse(node.dataset.relIds).every(id => id === 'notice-CREDIT')));
  assert.deepEqual(await selected(), ['notice-CREDIT']);
  await edge.dispatchEvent('pointerout');
  await page.waitForFunction(() => document.querySelectorAll('[data-eda-wire][data-highlight="true"]').length === 3);
  assert.deepEqual(await selected(), ['notice-CREDIT', 'notice-FINANCING', 'notice-REPAYMENT']);
  assert.equal(await page.evaluate(() => window.__fieldWorkers), 0);
  assert.deepEqual(await read(), stored);
  await page.screenshot({ path: path.join(out, 'field-selection.png'), scale: 'css' });
  console.log(JSON.stringify({ passed: true, out, checks: 'directory long-table last row at 100%, command and canvas selection agree, canvas click preserves camera, all conditional relationships, hover restore, zero layout workers for projected field focus, unchanged model' }));
}
