import assert from 'node:assert/strict';
import path from 'node:path';
import { conditionalModel } from '../desktop/test/fixtures/conditional-model.mjs';

export async function checkSelfReference({ page, replace, read, out }) {
  const model = conditionalModel(), table = model.tables.find(t => t.id === 'notifications');
  table.fields.push({ ...table.fields[0], id: 'original_id', name: 'original_id', primary: false, comment: 'Reference to the original record' });
  model.relationships.push({ ...model.relationships[0], id: 'self-original', name: 'original-record', startTableId: table.id, startFieldId: 'original_id', endTableId: table.id, endFieldId: table.fields[0].id, reviewEvidence: { kind: 'logical' } });
  assert.equal((await replace(model, page.url().split('/').at(-1))).ok, true);
  await page.locator('[data-eda-ready="true"]').waitFor({ timeout: 30000 });
  const wire = page.locator('[data-eda-wire][data-kind="self"]');
  assert.equal(await wire.count(), 1);
  assert.equal(await wire.locator('.eda-wire').getAttribute('stroke'), '#c47b08');
  const points = (await wire.locator('.eda-wire').getAttribute('d')).match(/-?\d+(?:\.\d+)?/g).map(Number);
  assert.equal(points.length, 8, 'only 4 points / 2 bends');
  assert.equal(points[0], points[6], 'both endpoints on the same side');
  assert.equal(points[2], points[4], 'one vertical return rail');
  assert.equal(Math.abs(points[2] - points[0]), 38, 'rail clears table and badges');
  const before = await read();
  await wire.dispatchEvent('click');
  await page.waitForFunction(() => document.querySelector('[data-kind="self"]')?.dataset.highlight === 'true');
  assert.equal(await wire.locator('.eda-wire').getAttribute('stroke'), '#c47b08');
  const badges = page.locator('[data-eda-cardinality][data-rel-ids=\'["self-original"]\']');
  assert.deepEqual((await badges.evaluateAll(nodes => nodes.map(n => n.dataset.edaCardinality))).sort(), ['1', 'N']);
  assert.deepEqual(await read(), before);
  await page.screenshot({ path: path.join(out, 'self-reference.png'), scale: 'css' });
  console.log(JSON.stringify({ passed: true, out, checks: 'same-side two-turn self reference, 38-unit clearance, amber color including selection, 1/N preserved, no model change' }));
}
