const { test } = require('node:test');
const assert = require('node:assert/strict');
test('minimap leaves an occupied lower-left corner and remains deterministic', async () => {
  const { minimapDock } = await import('../eda/minimap-dock.mjs');
  const layout = { width: 1000, height: 700, children: [{ x: 0, y: 520, width: 300, height: 180 }] };
  const dock = minimapDock(layout, { width: 1000, height: 700 });
  assert.equal(dock.name, 'top-left');
  assert.equal(dock.style.top, 52);
  assert.deepEqual(minimapDock(layout, { width: 1000, height: 700 }), dock);
});
