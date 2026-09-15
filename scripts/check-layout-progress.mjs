import assert from 'node:assert/strict';

export async function checkLayoutProgress({ page, app, interact = true }) {
  // Hold only the real worker's final delivery. The layout/validation engines
  // still run normally; this makes reader interaction before final deterministic.
  await page.evaluate(() => {
    const Original = window.Worker;
    window.Worker = class extends Original {
      set onmessage(handler) {
        super.onmessage = event => {
          if (event.data.type === 'progress' && !window.__layoutPreview) window.__layoutPreview = event.data.result;
          if (event.data.type === 'final') {
            window.__layoutFinal = event.data;
            window.__releaseFinal = () => handler(event);
          } else handler(event);
        };
      }
    };
  });
  await page.getByRole('button', { name: /^(Arrange|整理)$/ }).click();
  await page.getByText(/A usable layout is visible|已显示可用布局/).waitFor({ timeout: 25000 });
  if (interact) await page.getByRole('button', { name: /^(Zoom in|放大)$/ }).click();
  else await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1320, 820));
  const camera = await page.locator('[data-eda-scene]').getAttribute('viewBox');
  await page.waitForFunction(() => !!window.__releaseFinal, null, { timeout: 25000 });
  const differs = await page.evaluate(() => JSON.stringify(window.__layoutPreview.layout) !== JSON.stringify(window.__layoutFinal.result?.layout));
  await page.evaluate(() => window.__releaseFinal());
  await page.locator('[data-eda-ready="true"]').waitFor();
  if (interact) assert.equal(await page.locator('[data-eda-scene]').getAttribute('viewBox'), camera);
  if (!interact) assert.equal(await page.getByRole('button', { name: /Apply optimized layout|应用优化结果/ }).count(), 0);
  if (interact && differs) {
    await page.getByRole('button', { name: /Apply optimized layout|应用优化结果/ }).click();
    assert.equal(await page.locator('[data-eda-scene]').getAttribute('viewBox'), camera);
  }
  console.log(JSON.stringify({ passed: true, checks: interact ? 'real worker preview displayed, zoom accepted during optimization, final delivery preserves camera, explicit improvement application when geometry differs' : 'automatic viewport resize does not defer the final layout', differs }));
}
