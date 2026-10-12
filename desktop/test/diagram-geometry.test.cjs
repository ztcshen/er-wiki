const { test } = require('node:test');
const assert = require('node:assert/strict');

const twoTables = () => ({ tables: ['parent', 'child'].map(id => ({ id, name: id, x: 7, y: 9,
  fields: [{ id: 'id', name: 'id', primary: true }, { id: 'fk', name: 'parent_id' }] })), groups: [],
  relationships: [{ id: 'fk', startTableId: 'child', startFieldId: 'fk', endTableId: 'parent', endFieldId: 'id', cardinality: 'many_to_one' }] });

test('named view geometry is independent of editor placement and rerouting restores absolute coordinates', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const { validateLayout } = await import('../eda/metrics.mjs');
  const model = twoTables();
  model.tables[1].reviewPlacement = { belowTableId: 'parent', gap: 150 };
  const diagramView = { id: 'reading', name: 'Reading', depicts: [
    { tableId: 'parent', x: 650, y: 180 }, { tableId: 'child', x: 1220, y: 180 },
  ] }, before = JSON.stringify({ model, diagramView });
  const seen = [], result = await arrangeSchematic(model, { diagramView, labels: 'off', bundle: false, optimize: false, onCandidate: value => seen.push(value) });
  validateLayout(result.layout, result.projection);
  assert.equal(result.status, 'ready');
  for (const depict of diagramView.depicts) {
    const node = result.layout.children.find(n => n.id === 'table:' + JSON.stringify(depict.tableId));
    assert.equal(node.x, depict.x); assert.equal(node.y, depict.y);
  }
  assert.equal(result.diagnostics.fixedTables, 2);
  assert.equal(result.diagnostics.refinementMode, 'diagram-positions');
  assert(seen.length > 0 && seen.every(value => value.layout.children.find(n => n.id === 'table:"parent"').x === 650));
  assert.equal(JSON.stringify({ model, diagramView }), before);
});

test('completing partial geometry cannot produce table positions rejected by the view persistence contract', async () => {
  const { applyDiagramPositions } = await import('../eda/diagram-geometry.mjs');
  const { captureViewGeometry, validateDiagramViews } = await import('../eda/diagram-views.mjs');
  const projection = { nodes: ['a', 'b'].map(tableId => ({ id: tableId, kind: 'table', tableId, width: 360, height: 110, ports: [] })), edges: [] };
  const before = { children: [{ id: 'a', x: 0, y: 0, width: 360, height: 110 }, { id: 'b', x: 50, y: 40, width: 360, height: 110 }], edges: [] };
  const layout = applyDiagramPositions(projection, before, new Map([['a', { x: 40, y: 40 }]]));
  assert(layout.children.every(n => n.x >= 0 && n.y >= 0));
  const saved = captureViewGeometry({ id: 'partial', name: 'Partial', depicts: [{ tableId: 'a', x: 40, y: 40 }, { tableId: 'b' }] }, { projection, layout });
  assert.doesNotThrow(() => validateDiagramViews([saved], ['a', 'b'].map(id => ({ id, fields: [] }))));
  assert.deepEqual(layout.children.find(n => n.id === 'a'), { id: 'a', x: 40, y: 40, width: 360, height: 110 });
});

test('a partly positioned diagram completes other table slots while preserving the single pin', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const model = twoTables();
  model.tables.push({ id: 'extra', name: 'extra', fields: [] });
  const diagramView = { id: 'partial', name: 'Partial', depicts: [{ tableId: 'parent', x: 120, y: 400 }, { tableId: 'child' }, { tableId: 'extra' }] };
  const result = await arrangeSchematic(model, { diagramView, labels: 'off', bundle: false, optimize: false });
  const parent = result.layout.children.find(n => n.id === 'table:"parent"');
  assert.deepEqual([parent.x, parent.y], [120, 400]);
  assert.equal(result.layout.children.length, 3);
  assert.equal(result.metrics.overlaps, 0);
});

test('failed pinned-view computation reports retained geometry instead of silently publishing an unpinned fallback', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const model = twoTables(), diagramView = { id: 'failed', depicts: [
    { tableId: 'parent', x: 650, y: 180 }, { tableId: 'child', x: 1220, y: 180 },
  ] }, before = JSON.stringify({ model, diagramView }), seen = [];
  await assert.rejects(arrangeSchematic(model, { diagramView, onCandidate: result => seen.push(result) }, { layout: async () => { throw Error('Synthetic engine failure'); } }),
    error => error.code === 'DIAGRAM_VIEW_ROUTING_INVALID' && error.candidateErrors.length === 2 && /已保留位置/.test(error.message));
  assert.deepEqual(seen, []);
  assert.equal(JSON.stringify({ model, diagramView }), before);
});

test('overlapping or incomplete saved positions fail clearly before engine work and never move a saved pin', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const engine = { layout: async () => assert.fail('invalid saved geometry must be rejected first') };
  const model = twoTables(), before = JSON.stringify(model);
  await assert.rejects(arrangeSchematic(model, { diagramView: { depicts: [{ tableId: 'parent', x: 100, y: 100 }, { tableId: 'child', x: 100, y: 100 }] } }, engine),
    error => error.code === 'DIAGRAM_VIEW_POSITION_CONFLICT' && error.nodeIds.length === 2);
  await assert.rejects(arrangeSchematic(model, { diagramView: { depicts: [{ tableId: 'parent', x: 100 }] } }, engine),
    error => error.code === 'DIAGRAM_VIEW_POSITION_INVALID');
  for (const x of [-1, 1e7 + 1]) await assert.rejects(arrangeSchematic(model, { diagramView: { depicts: [{ tableId: 'parent', x, y: 100 }] } }, engine),
    error => error.code === 'DIAGRAM_VIEW_POSITION_INVALID');
  assert.equal(JSON.stringify(model), before);
});

test('table and domain drill-down ignore an overview diagram coordinate set', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const model = twoTables(), diagramView = { id: 'overview', depicts: [
    { tableId: 'parent', x: 100, y: 100 }, { tableId: 'child', x: 100, y: 100 },
  ] };
  for (const level of ['table', 'domain']) {
    const result = await arrangeSchematic(model, { level, tableId: 'child', diagramView, labels: 'off', optimize: false });
    assert.equal(result.status, 'ready');
    assert.equal(result.diagnostics.fixedTables, 0);
    assert(result.layout.children.some(n => n.x !== 100 || n.y !== 100));
  }
});

test('a fixed diagram keeps composite field identities and its conditional relation label', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const model = { tables: [{ id: 'target', name: 'target', fields: [{ id: 'id', name: 'id', primary: true }, { id: 'type', name: 'type', primary: true }] },
    { id: 'source', name: 'source', fields: [{ id: 'fk', name: 'target_id' }, { id: 'fk-type', name: 'target_type' }, { id: 'business', name: 'business_type' }] }], groups: [],
    relationships: [{ id: 'composite', startTableId: 'source', endTableId: 'target', fields: [
      { startFieldId: 'fk', endFieldId: 'id' }, { startFieldId: 'fk-type', endFieldId: 'type' },
    ], cardinality: 'many_to_one', reviewEvidence: { kind: 'logical', condition: { field: 'business_type', value: 'ORDER' } } }] };
  const diagramView = { id: 'composite', name: 'Composite', depicts: [{ tableId: 'target', x: 100, y: 100 }, { tableId: 'source', x: 1100, y: 100 }] };
  const before = JSON.stringify(model), result = await arrangeSchematic(model, { diagramView, labels: 'off', bundle: false });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.projection.covered, ['composite']);
  assert.equal(result.projection.edges[0].kind, 'conditional');
  const ports = result.projection.nodes.flatMap(n => n.ports);
  assert(ports.some(p => JSON.stringify(p.fieldIds) === JSON.stringify(['id', 'type'])));
  assert(ports.some(p => JSON.stringify(p.fieldIds) === JSON.stringify(['fk', 'fk-type'])));
  assert(result.layout.edges[0].labels[0].text.includes('ORDER'));
  assert.equal(JSON.stringify(model), before);
});

test('a real named-view snapshot roundtrip keeps pins valid over independent editor placement', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const { layoutSnapshot, restoreLayoutSnapshot } = await import('../eda/layout-snapshot.mjs');
  const { candidateValidity } = await import('../eda/layout-quality.mjs');
  const model = twoTables();
  model.tables[1].reviewPlacement = { belowTableId: 'parent', gap: 150 };
  const diagramView = { id: 'snapshot', name: 'Snapshot', depicts: [
    { tableId: 'parent', x: 650, y: 180 }, { tableId: 'child', x: 1220, y: 180 },
  ] }, options = { level: 'overview', diagramView, labels: 'off', bundle: false, optimize: false };
  const result = await arrangeSchematic(model, options), snapshot = JSON.parse(JSON.stringify(layoutSnapshot(result)));
  model.tables[0].comment = 'Fresh content';
  const restored = restoreLayoutSnapshot(snapshot, model, options);
  assert(candidateValidity(restored).valid, 'restoring legacy placement must not invalidate named geometry');
  assert.deepEqual(restored.layout.children.map(n => [n.id, n.x, n.y]), result.layout.children.map(n => [n.id, n.x, n.y]));
  assert.equal(restored.projection.nodes.find(n => n.tableId === 'parent').comment, 'Fresh content');
  assert.deepEqual(model.tables[1].reviewPlacement, { belowTableId: 'parent', gap: 150 });
  const changed = structuredClone(diagramView); changed.depicts[0].x += 20;
  assert.throws(() => restoreLayoutSnapshot(snapshot, model, { ...options, diagramView: changed }), /Cached diagram positions differ/);
});

test('all four outward routes and field bindings survive exact coordinate restoration', async () => {
  const { projectModel } = await import('../eda/model.mjs');
  const { movePorts, PORT_SIDES } = await import('../eda/ports.mjs');
  const { diagramViewPositions, applyDiagramPositions, routeDiagramGeometry } = await import('../eda/diagram-geometry.mjs');
  const { validateLayout } = await import('../eda/metrics.mjs');
  const sides = ['NORTH', 'SOUTH', 'WEST', 'EAST'], opposite = { NORTH: 'SOUTH', SOUTH: 'NORTH', WEST: 'EAST', EAST: 'WEST' };
  const model = { tables: [{ id: 'core', name: 'core', fields: sides.map(id => ({ id, name: id })) }, ...sides.map(id => ({ id, name: id, fields: [{ id: 'fk', name: 'fk' }] }))], groups: [],
    relationships: sides.map(id => ({ id, startTableId: id, startFieldId: 'fk', endTableId: 'core', endFieldId: id, cardinality: 'many_to_one' })) };
  const raw = projectModel(model, { labels: 'off', bundle: false });
  const projection = movePorts(raw, raw.edges.flatMap(e => [{ id: e.sources[0], side: e.refs[0] }, { id: e.targets[0], side: opposite[e.refs[0]] }]));
  const coords = { core: [500, 500], NORTH: [500, 120], SOUTH: [500, 1000], WEST: [40, 500], EAST: [1100, 500] };
  const diagramView = { depicts: Object.entries(coords).map(([tableId, [x, y]]) => ({ tableId, x, y })) };
  const positions = diagramViewPositions(projection, diagramView), seed = { children: projection.nodes.map(n => ({ ...n, x: 0, y: 0 })), edges: [] };
  const before = JSON.stringify({ model, projection, seed, diagramView });
  const layout = await routeDiagramGeometry(projection, applyDiagramPositions(projection, seed, positions), positions);
  validateLayout(layout, projection);
  for (const edge of layout.edges) {
    const section = edge.sections[0], points = [section.startPoint, ...section.bendPoints, section.endPoint];
    for (const [id, tip, next] of [[edge.sources[0], points[0], points[1]], [edge.targets[0], points.at(-1), points.at(-2)]]) {
      const owner = projection.nodes.find(n => n.ports.some(p => p.id === id)), port = owner.ports.find(p => p.id === id);
      const node = layout.children.find(n => n.id === owner.id), normal = PORT_SIDES[port.layoutOptions['elk.port.side']];
      assert.deepEqual([node.x, node.y], coords[owner.tableId]);
      assert(Math.abs(tip.x - node.x - port.x) < .01 && Math.abs(tip.y - node.y - port.y) < .01);
      assert((next.x - tip.x) * normal.dx + (next.y - tip.y) * normal.dy > 0);
      assert.deepEqual(node.ports.find(p => p.id === id).fieldIds, port.fieldIds);
    }
  }
  assert.equal(Math.min(...layout.children.map(n => n.x)), 40);
  assert.equal(JSON.stringify({ model, projection, seed, diagramView }), before);
});
