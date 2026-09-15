const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = () => ({ tables: [{ id: 'entries', name: 'entries', fields: [
  { id: 'no', name: 'entry_no', primary: true }, { id: 'direction', name: 'direction' }, { id: 'origin', name: 'origin_no' },
] }], relationships: [{ id: 'origin-reference', startTableId: 'entries', startFieldId: 'origin', endTableId: 'entries', endFieldId: 'no', cardinality: 'many_to_one', reviewEvidence: { kind: 'logical' } }], groups: [] });

test('self references retain one direct edge under every label mode and never join external buses', async () => {
  const { projectModel } = await import('../eda/model.mjs');
  const model = fixture();
  model.tables.push({ id: 'other', name: 'other', fields: [{ id: 'fk', name: 'entry_no' }] });
  model.relationships.push({ id: 'external', startTableId: 'other', startFieldId: 'fk', endTableId: 'entries', endFieldId: 'no' });
  for (const labels of ['off', 'auto', 'all']) {
    const projection = projectModel(model, { level: 'overview', labels });
    const self = projection.edges.filter(edge => edge.refs.includes('origin-reference'));
    assert.equal(self.length, 1); assert.equal(self[0].kind, 'self');
    assert.deepEqual(self[0].refs, ['origin-reference']);
    assert.equal(projection.nets.filter(net => net.selfReference).length, 1);
    assert.equal(projection.nets.find(net => net.selfReference).members.length, 1);
    const ports = projection.nodes.flatMap(node => node.ports).filter(port => [...self[0].sources, ...self[0].targets].includes(port.id));
    assert(ports.every(port => port.layoutOptions['elk.port.side'] === 'EAST'));
  }
});

test('unobstructed self reference is a two-turn shortest same-side Manhattan return, with stable cache and cardinality', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const { cardinalityBadges } = await import('../eda/cardinality.mjs');
  const { layoutSnapshot, restoreLayoutSnapshot } = await import('../eda/layout-snapshot.mjs');
  const { relationColor, SELF_REFERENCE_COLOR } = await import('../eda/presentation.mjs');
  const model = fixture(), before = JSON.stringify(model), options = { level: 'overview', labels: 'all' };
  const errors = [], result = await arrangeSchematic(model, { ...options, onPositionError: error => errors.push(error.message) });
  assert.deepEqual(errors, []); assert.equal(result.status, 'ready');
  const edge = result.layout.edges[0], section = edge.sections[0];
  assert.equal(section.bendPoints.length, 2);
  assert.equal(section.startPoint.x, section.endPoint.x);
  assert.equal(result.metrics.length, Math.abs(section.startPoint.y - section.endPoint.y) + 76);
  assert.equal(result.metrics.bends, 2);
  const meta = result.projection.edges[0];
  assert.equal(relationColor(meta, new Map(), new Map()), SELF_REFERENCE_COLOR);
  assert.deepEqual(cardinalityBadges(result).map(b => b.value).sort(), ['1', 'N']);
  const restored = restoreLayoutSnapshot(layoutSnapshot(result), model, options);
  assert.deepEqual(restored.layout.edges[0].sections, edge.sections);
  assert.equal(restored.projection.edges[0].kind, 'self');
  assert.equal(JSON.stringify(model), before);
});
