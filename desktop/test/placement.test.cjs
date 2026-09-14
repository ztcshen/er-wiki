const { test } = require('node:test');
const assert = require('node:assert/strict');
const setup = async () => {
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const model = conditionalModel();
  model.tables.push({ id: 'accounts', name: 'accounts', fields: [{ id: 'accounts.id', name: 'id', primary: true }] });
  model.groups[0].tableIds.push('accounts');
  model.tables.find(t => t.id === 'notifications').reviewPlacement = {
    belowTableId: 'accounts', leftOfTableId: 'loans', gap: 200, offsetX: 0,
  };
  return model;
};

test('ELK honors the requested below/left region while rerouting all conditional edges', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const model = await setup(), before = JSON.stringify(model);
  const result = await arrangeSchematic(model, { level: 'overview', labels: 'off', bundle: true });
  const node = id => result.layout.children.find(n => n.id === 'table:' + JSON.stringify(id));
  assert(node('notifications').y >= node('accounts').y + node('accounts').height + 64);
  assert(node('notifications').x + node('notifications').width < node('loans').x);
  assert.equal(result.metrics.overlaps, 0);
  assert.equal(result.projection.covered.length, model.relationships.length);
  assert.equal(result.projection.edges.filter(e => e.kind === 'conditional').length, 3);
  assert(result.candidates.every(c => c.placement));
  assert.equal(JSON.stringify(model), before);
});

test('placement metadata changes geometry keys but does not apply in drill-down views', async () => {
  const { geometryKey } = await import('../eda/layout-content.mjs');
  const { projectModel } = await import('../eda/model.mjs');
  const { placementHints } = await import('../eda/placement.mjs');
  const model = await setup(), oldKey = geometryKey(model, { level: 'overview' });
  model.tables.find(t => t.id === 'notifications').reviewPlacement.gap += 100;
  assert.notEqual(geometryKey(model, { level: 'overview' }), oldKey);
  assert.deepEqual(placementHints(projectModel(model, { level: 'domain', domainId: 'inbox' })), []);
});

test('invalid targets and cyclic placement fail explicitly without mutating input', async () => {
  const { projectModel } = await import('../eda/model.mjs');
  const { placementHints, placementPositions } = await import('../eda/placement.mjs');
  const model = await setup();
  model.tables.find(t => t.id === 'notifications').reviewPlacement.belowTableId = 'missing';
  assert.throws(() => placementHints(projectModel(model, { level: 'overview' })), /Invalid/);
  const layout = { children: [{ id: 'a', x: 0, y: 0, width: 100, height: 100 }, { id: 'b', x: 200, y: 0, width: 100, height: 100 }] };
  const before = JSON.stringify(layout);
  assert.throws(() => placementPositions(layout, [{ nodeId: 'a', anchorId: 'b', gap: 100, offsetX: 0 }, { nodeId: 'b', anchorId: 'a', gap: 100, offsetX: 0 }]), /Cyclic/);
  assert.equal(JSON.stringify(layout), before);
});
