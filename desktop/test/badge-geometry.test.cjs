const { test } = require('node:test');
const assert = require('node:assert/strict');
test('mixed badges stay outside all four table sides and keep geometry during focus', async () => {
  const { cardinalityBadges } = await import('../eda/cardinality.mjs');
  for (const side of ['NORTH', 'SOUTH', 'WEST', 'EAST']) {
    const node = { id: 'table', tableId: 0, kind: 'table', x: 100, y: 100, width: 200, height: 120,
      ports: [{ id: 'port', x: side === 'WEST' ? 0 : side === 'EAST' ? 200 : 100,
        y: side === 'NORTH' ? 0 : side === 'SOUTH' ? 120 : 60, layoutOptions: { 'elk.port.side': side } }] };
    const result = { layout: { children: [node] }, projection: { nodes: [node],
      nets: [{ members: [{ id: 0, cardinality: 'many_to_one' }, { id: 1, cardinality: 'one_to_many' }] }],
      edges: [{ sources: ['port'], targets: [], netIds: ['net'], refs: [0, 1] }] } };
    const badge = cardinalityBadges(result)[0], focused = cardinalityBadges(result, 0)[0];
    assert.equal(badge.value, '混合'); assert.equal(focused.value, '1');
    for (const key of ['x', 'y', 'width', 'height']) assert.equal(badge[key], focused[key]);
    if (side === 'WEST') assert(badge.x + badge.width / 2 < node.x);
    if (side === 'EAST') assert(badge.x - badge.width / 2 > node.x + node.width);
    if (side === 'NORTH') assert(badge.y + badge.height / 2 < node.y);
    if (side === 'SOUTH') assert(badge.y - badge.height / 2 > node.y + node.height);
  }
});

test('geometry key responds to mixed width, not color or same-sized text changes', async () => {
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const { geometryKey, refreshLayoutContent } = await import('../eda/layout-content.mjs');
  const { projectModel } = await import('../eda/model.mjs');
  const model = conditionalModel(), options = { level: 'overview', labels: 'off' };
  const initial = geometryKey(model, options);
  const projection = projectModel(model, options);
  model.groups[0].color = '#abcdef';
  assert.equal(geometryKey(model, options), initial);
  const refreshed = refreshLayoutContent({ projection }, model).projection;
  assert.equal(refreshed.domains[0].color, '#abcdef');
  assert.equal(refreshed.nodes.find(n => n.tableId === 'loans').color, '#abcdef');
  model.relationships[0].cardinality = 'one_to_one';
  assert.equal(geometryKey(model, options), initial);
  model.relationships[1].cardinality = 'one_to_many';
  assert.notEqual(geometryKey(model, options), initial);
});
