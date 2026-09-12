const { test } = require('node:test');
const assert = require('node:assert/strict');
const camera = import('../eda/camera.mjs');
const close = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('cursor zoom preserves the pointed world location including SVG letterboxing', async () => {
  const { clientPointToWorld, zoomAtPoint } = await camera;
  for (const view of [[100, 200, 2000, 500], [100, 200, 500, 2000]]) {
    const rect = { left: 80, top: 120, width: 1200, height: 800 };
    const anchor = clientPointToWorld(view, rect, 920, 410);
    const next = zoomAtPoint(view, .75, anchor);
    const after = clientPointToWorld(next, rect, 920, 410);
    close(anchor.x, after.x); close(anchor.y, after.y);
    close(next[2] / next[3], view[2] / view[3]);
  }
});

test('navigation keeps camera center and scale separate; large fitted views can zoom in', async () => {
  const { actualSizeView, centerViewAt, focusNodeView, viewScale, visibleWorldView, zoomAtPoint } = await camera;
  const view = [100, 200, 2000, 500], viewport = { width: 1200, height: 800 };
  const native = actualSizeView(view, viewport);
  assert.equal(viewScale(native, viewport), 1);
  close(native[0] + native[2] / 2, 1100); close(native[1] + native[3] / 2, 450);
  assert.deepEqual(centerViewAt(view, { x: 3000, y: 4000 }), [2000, 3750, 2000, 500]);
  const visible = visibleWorldView(view, viewport);
  close(visible[2] / visible[3], 1.5); close(visible[0] + visible[2] / 2, 1100);
  assert(zoomAtPoint([0, 0, 200000, 100000], .8)[2] < 200000);
  assert.equal(zoomAtPoint([0, 0, 100, 50], .1)[2], 100);
  assert.equal(zoomAtPoint([0, 0, 1e7, 1e7], 2)[2], 1e7);
  assert.deepEqual(zoomAtPoint(view, NaN), view);
  const focused = focusNodeView({ x: 20, y: 30, width: 360, height: 300 }, viewport);
  assert(viewScale(focused, viewport) <= 1, 'Focus should not inflate small table cards beyond reading size');
});

test('layout direction persists per model and bookmarks without invalidating old AUTO view keys', async () => {
  const { cleanLocation, normalizeReadingState, scopeKey, restoreLocation } = await import('../eda/reading-state.mjs');
  const oldKey = '["overview","",null,"off",true,[]]';
  assert.equal(scopeKey({}), oldKey);
  const saved = normalizeReadingState({ views: { [oldKey]: [10, 20, 900, 600] },
    location: { direction: 'DOWN' }, bookmarks: [{ id: 'test', name: 'Horizontal', location: { direction: 'RIGHT' } }] });
  assert.deepEqual(saved.views[oldKey], [10, 20, 900, 600]);
  assert.equal(saved.location.direction, 'DOWN');
  assert.equal(saved.bookmarks[0].location.direction, 'RIGHT');
  assert.notEqual(scopeKey(saved.location), oldKey);
  assert.equal(cleanLocation({ direction: 'untrusted' }).direction, 'AUTO');
  assert.equal(restoreLocation({ level: 'table', tableId: 'removed', direction: 'DOWN' }, { tables: [], groups: [] }).direction, 'DOWN');
});

test('explicit orientation restricts ELK candidates while retaining orthogonal routes and scoring priority', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const { validateLayout, compareScores } = await import('../eda/metrics.mjs');
  const fixture = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '../../examples/fulfillment.drawdb.json'), 'utf8'));
  const model = { tables: fixture.tables, relationships: fixture.relationships, groups: fixture.reviewGroups };
  const before = JSON.stringify(model);
  for (const direction of ['RIGHT', 'DOWN']) {
    const result = await arrangeSchematic(model, { level: 'overview', labels: 'off', bundle: true, direction });
    validateLayout(result.layout, result.projection);
    assert.equal(result.candidates.length, 2);
    assert(result.candidates.every(candidate => candidate.direction === direction && compareScores(result.metrics, candidate.metrics) <= 0));
    assert.equal(result.projection.nodes.filter(node => node.kind === 'table').length, 13);
  }
  assert.equal(JSON.stringify(model), before);
});
