const { test } = require('node:test');
const assert = require('node:assert/strict');

test('horizontal rails retain field identity, separate leads and restore original row', async () => {
  const { movePorts } = await import('../eda/ports.mjs');
  const p = { nodes: [{ id: 'n', width: 360, height: 240, ports: [0, 1, 2].map(i => ({ id: `p${i}`, fieldIds: ['same-field'], x: 0, y: 92 + i * 4, badgeY: 96, layoutOptions: { 'elk.port.side': 'WEST' } })) }], edges: [] };
  const before = JSON.stringify(p), top = movePorts(p, p.nodes[0].ports.map(port => ({ id: port.id, side: 'NORTH' })));
  assert(top.nodes[0].ports.every(port => port.y === 0 && port.badgeY === 0));
  assert.equal(new Set(top.nodes[0].ports.map(port => port.x)).size, 3);
  assert.equal(new Set(top.nodes[0].ports.map(port => port.badgeX)).size, 1);
  const restored = movePorts(top, top.nodes[0].ports.map(port => ({ id: port.id, side: 'WEST' })));
  assert.deepEqual(restored.nodes[0].ports.map(port => [port.id, port.x, port.y, port.badgeY, port.fieldIds]), p.nodes[0].ports.map(port => [port.id, port.x, port.y, port.badgeY, port.fieldIds]));
  assert.equal(JSON.stringify(p), before);
});

test('native routing honors all four pin directions and outward cardinality badges', async () => {
  const { projectModel } = await import('../eda/model.mjs');
  const { movePorts, PORT_SIDES } = await import('../eda/ports.mjs');
  const { loadObstacleRouter, routeObstacles } = await import('../eda/obstacle-router.mjs');
  const { cardinalityBadges } = await import('../eda/cardinality.mjs');
  const { validateLayout } = await import('../eda/metrics.mjs');
  const sides = ['NORTH', 'SOUTH', 'WEST', 'EAST'];
  const model = { tables: [{ id: 'core', name: 'core', fields: sides.map(id => ({ id, name: id })) }, ...sides.map(id => ({ id, name: id, fields: [{ id: 'fk', name: 'fk' }] }))], groups: [], relationships: sides.map(id => ({ id, startTableId: id, startFieldId: 'fk', endTableId: 'core', endFieldId: id, cardinality: 'many_to_one' })) };
  const projected = projectModel(model, { labels: 'off', bundle: false });
  const owner = new Map(projected.nodes.flatMap(n => n.ports.map(p => [p.id, n]))), opposite = { NORTH: 'SOUTH', SOUTH: 'NORTH', WEST: 'EAST', EAST: 'WEST' };
  const changes = projected.edges.flatMap(e => [{ id: e.sources[0], side: e.refs[0] }, { id: e.targets[0], side: opposite[e.refs[0]] }]);
  const projection = movePorts(projected, changes), coords = { core: [500, 500], NORTH: [500, 160], SOUTH: [500, 1000], WEST: [40, 500], EAST: [1000, 500] };
  const seed = { children: projection.nodes.map(n => ({ ...n, x: coords[n.tableId][0], y: coords[n.tableId][1] })), edges: [] };
  const layout = routeObstacles(await loadObstacleRouter(), projection, seed);
  validateLayout(layout, projection);
  const nodes = new Map(layout.children.map(n => [n.id, n]));
  for (const e of layout.edges) {
    const s = e.sections[0], points = [s.startPoint, ...s.bendPoints, s.endPoint];
    for (const [id, tip, next] of [[e.sources[0], points[0], points[1]], [e.targets[0], points.at(-1), points.at(-2)]]) {
      const meta = projection.nodes.find(n => n.id === owner.get(id).id), port = meta.ports.find(p => p.id === id), n = nodes.get(meta.id), normal = PORT_SIDES[port.layoutOptions['elk.port.side']];
      assert(Math.abs(tip.x - n.x - port.x) < .01 && Math.abs(tip.y - n.y - port.y) < .01);
      assert((next.x - tip.x) * normal.dx + (next.y - tip.y) * normal.dy > 0, 'Path must leave outward, including at the destination');
    }
  }
  for (const b of cardinalityBadges({ projection, layout })) {
    const n = layout.children.find(n => owner.get(projection.nodes.find(m => m.tableId === b.tableId).ports[0].id).id === n.id);
    assert(b.side === 'NORTH' ? b.y < n.y : b.side === 'SOUTH' ? b.y > n.y + n.height : b.side === 'WEST' ? b.x < n.x : b.x > n.x + n.width);
  }
});

test('SPOrE compresses a sparse layout without changing node sizes or input', async () => {
  const { compactLayoutSeeds } = await import('../eda/compact-layout.mjs');
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const nodes = [0, 1, 2].map(i => ({ id: `n${i}`, tableId: `t${i}`, kind: 'table', width: 360, height: 200, ports: [] }));
  const projection = { level: 'overview', nodes }, layout = { children: nodes.map((n, i) => ({ ...n, x: 40 + i * 1200, y: 100 })), edges: [] };
  const before = JSON.stringify(layout), seeds = await compactLayoutSeeds(projection, layout, new ELK());
  assert(seeds.length > 0);
  assert(seeds.some(({ layout }) => Math.max(...layout.children.map(n => n.x + n.width)) - Math.min(...layout.children.map(n => n.x)) < 2760));
  for (const seed of seeds) assert(seed.layout.children.every(n => n.width === 360 && n.height === 200));
  assert.equal(JSON.stringify(layout), before);
});
