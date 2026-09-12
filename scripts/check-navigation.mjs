import assert from 'node:assert/strict';
import path from 'node:path';

// Focused real-Electron navigation checks; no business fixtures or old canvas mode.
export async function checkNavigation({ app, page, record, output }) {
  const original = await record();
  const scene = page.locator('[data-eda-scene]');
  const ready = () => page.locator('[data-eda-ready="true"]').waitFor({ timeout: 30000 });
  const view = () => scene.evaluate(svg => svg.getAttribute('viewBox').split(' ').map(Number));
  const worldAt = point => scene.evaluate((svg, point) => {
    const p = new DOMPoint(point.x, point.y).matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }, point);
  const display = () => page.getByRole('button', { name: 'Diagram display settings', exact: true }).click();
  const chooseDirection = async direction => {
    await display();
    await page.getByRole('combobox', { name: 'Layout direction' }).selectOption(direction);
    await display(); await ready();
    await page.waitForFunction(expected => {
      const value = JSON.parse(localStorage.getItem('erwiki.reader.v1.demo-fulfillment') || '{}');
      return value.location?.direction === expected;
    }, direction);
  };
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900));
  assert.equal(await page.locator('[data-minimap-node]').count(), 13);
  await page.getByRole('button', { name: 'Actual size (100%)', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.eda-scale-button')?.textContent === '100%');
  const rect = await scene.boundingBox(), point = { x: Math.round(rect.x + rect.width * .65), y: Math.round(rect.y + rect.height * .35) };
  const anchor = await worldAt(point), previous = await view();
  await page.mouse.move(point.x, point.y); await page.mouse.wheel(0, -120);
  await page.waitForFunction(width => Number(document.querySelector('[data-eda-scene]').getAttribute('viewBox').split(' ')[2]) < width, previous[2]);
  const after = await worldAt(point);
  assert(Math.abs(anchor.x - after.x) < .1 && Math.abs(anchor.y - after.y) < .1, 'Wheel zoom moved the pointed world location: ' + JSON.stringify({anchor,after,point,previous,next:await view()}));
  const beforeMap = await view(), mini = page.getByRole('group', { name: 'Navigation minimap' });
  const box = await mini.boundingBox();
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .5); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .8, box.y + box.height * .6); await page.mouse.up();
  const afterMap = await view(); assert.notDeepEqual(afterMap.slice(0, 2), beforeMap.slice(0, 2));
  assert.deepEqual(afterMap.slice(2), beforeMap.slice(2));
  await mini.focus(); await mini.press('ArrowLeft');
  assert((await view())[0] < afterMap[0]);
  await mini.press('Home');
  assert.equal(await page.locator('[data-node-kind="table"]').count(), 13);
  await chooseDirection('DOWN');
  await page.reload(); await ready();
  await display(); assert.equal(await page.getByRole('combobox', { name: 'Layout direction' }).inputValue(), 'DOWN');
  await page.getByRole('checkbox', { name: 'Show navigation minimap' }).uncheck();
  await display(); assert.equal(await page.locator('.eda-minimap').count(), 0);
  await display(); await page.getByRole('checkbox', { name: 'Show navigation minimap' }).check(); await display();
  await chooseDirection('RIGHT');
  assert.equal(await page.locator('[data-node-kind="table"]').count(), 13);
  await chooseDirection('AUTO');
  await page.getByRole('button', { name: 'Quick search', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search actions or fields' }).fill('orders.status');
  await page.getByRole('option', { name: /^orders\.status/ }).click(); await ready();
  await page.waitForFunction(() => Number(document.querySelector('[data-eda-scene]').getAttribute('viewBox').split(' ')[2]) < 1000);
  await page.screenshot({ path: path.join(output, 'navigation-focus.png'), animations: 'disabled' });
  for (const width of [1440, 980]) {
    await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setContentSize(width, 900), width);
    await page.waitForFunction(width => innerWidth === width, width);
    const boxes = await page.locator('.eda-minimap,.eda-canvas-controls').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right };
    }));
    assert(boxes[0].right < boxes[1].left, 'Minimap overlaps navigation controls');
    await page.getByRole('button', { name: 'Actual size (100%)', exact: true }).click({ trial: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.screenshot({ path: path.join(output, 'navigation-compact.png'), animations: 'disabled' });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900));
  await page.getByRole('combobox', { name: 'Schematic level' }).selectOption('overview'); await ready();
  await page.getByRole('button', { name: 'Fit to window', exact: true }).click();
  const final = await record();
  assert.deepEqual(final.tables, original.tables); assert.deepEqual(final.references, original.references);
  assert.equal(final.lastModified.getTime(), original.lastModified.getTime());
  console.log('PASS: cursor anchor, 100% scale, minimap pointer/keyboard navigation, orientation/reload, 13-table overview, compact controls, unchanged model/save time');
}
