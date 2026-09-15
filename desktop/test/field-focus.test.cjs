const { test } = require('node:test');
const assert = require('node:assert/strict');
test('middle and last rows of a long table remain centered at readable scale', async () => {
  const { focusFieldView, viewScale } = await import('../eda/camera.mjs');
  const fields = Array.from({ length: 50 }, (_, id) => ({ id }));
  const node = { x: 130, y: 230, width: 360, height: 1578 };
  for (const viewport of [{ width: 800, height: 600 }, { width: 1440, height: 900 }])
    for (const id of [0, 25, 49]) {
      const view = focusFieldView(node, fields, id, viewport);
      assert.equal(viewScale(view, viewport), 1);
      assert.equal(view[1] + view[3] / 2, node.y + 78 + id * 30 + 15);
      assert.equal(view[0] + view[2] / 2, node.x + node.width / 2);
    }
  assert.equal(focusFieldView(node, fields, 'missing', { width: 800, height: 600 }), null);
});
