import assert from 'node:assert/strict';
import path from 'node:path';
import { conditionalModel } from '../desktop/test/fixtures/conditional-model.mjs';

export async function checkTableReview({ page, read, replace, out }) {
  const model = conditionalModel(), table = model.tables.find(t => t.id === 'notifications');
  table.reviewChineseName = '业务通知';
  table.indices = [{ name: 'ix_kind_id', unique: false, fields: ['business_type', 'id'] }];
  table.reviewContext = { purpose: 'Store fictional business notifications', grain: 'One received message', authority: { kind: 'design', summary: 'Example only', source: { kind: 'doc', locator: 'example.md' } } };
  model.processModel = { version: 1, scenarios: [{ id: 'demo', name: 'Notification example', flows: [], steps: [{ id: 'receive', name: 'Receive notification', kind: 'action', bindings: [{ tableId: table.id, fieldIds: ['notifications.business_type'], access: 'create' }] }] }] };
  const id = page.url().split('/').at(-1);
  assert.equal((await replace(model, id)).ok, true);
  await page.locator('[data-eda-ready="true"]').waitFor({ timeout: 30000 });
  await page.locator('[data-table-id="notifications"] .eda-node-title').click();
  await page.locator('.eda-table-details h3', { hasText: '业务通知' }).waitFor();
  await page.locator('[data-table-review-context] summary').click();
  await page.getByText('One received message', { exact: true }).waitFor();
  await page.getByText('doc: example.md', { exact: true }).waitFor();
  await page.locator('[data-table-process-access] summary').click();
  await page.getByText('Notification example · Receive notification', { exact: true }).waitFor();
  await page.locator('[data-table-constraints] summary').click();
  const index = page.locator('.eda-constraint').filter({ has: page.getByText('ix_kind_id', { exact: true }) });
  assert.deepEqual(await index.getByRole('button').allTextContents(), ['business_type', 'id']);
  const stored = await read();
  await page.screenshot({ path: path.join(out, 'table-review.png'), scale: 'css' });
  await index.getByRole('button', { name: 'business_type', exact: true }).click();
  await page.locator('[data-eda-field-details] h3', { hasText: 'business_type' }).waitFor();
  assert.deepEqual(await read(), stored);
  assert.deepEqual(stored.find(row => row.diagramId === id).tables.find(t => t.id === table.id).reviewContext, table.reviewContext);
  console.log(JSON.stringify({ passed: true, out, checks: 'business title, purpose/grain/source, existing process access, ordered index fields, index-to-field navigation, unchanged stored model' }));
}
