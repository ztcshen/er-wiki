const { test } = require('node:test');
const assert = require('node:assert/strict');

const groupedModel = () => {
  const tables = ['a', 'a-child', 'a-extra', 'b', 'b-child'].map(id => ({ id, name: id,
    fields: [{ id: 'id', name: 'id', primary: true }, { id: 'parent', name: 'parent_id' }] }));
  return { tables, groups: [{ id: 'domain-a', name: 'A', tableIds: ['a', 'a-child', 'a-extra'] },
    { id: 'domain-b', name: 'B', tableIds: ['b', 'b-child'] }], relationships: [
    { id: 'a-inner', startTableId: 'a-child', startFieldId: 'parent', endTableId: 'a', endFieldId: 'id', cardinality: 'many_to_one' },
    { id: 'b-inner', startTableId: 'b-child', startFieldId: 'parent', endTableId: 'b', endFieldId: 'id', cardinality: 'many_to_one' },
    { id: 'cross', startTableId: 'b', startFieldId: 'parent', endTableId: 'a-child', endFieldId: 'id', cardinality: 'many_to_one' },
  ] };
};

test('two ELK stages preserve every node and put each domain in its own rectangle before global routing', async () => {
  const { projectModel } = await import('../eda/model.mjs');
  const { arrangeDomainGroups } = await import('../eda/group-layout.mjs');
  const { routeDiagramGeometry } = await import('../eda/diagram-geometry.mjs');
  const { validateLayout } = await import('../eda/metrics.mjs');
  const { rectanglesOverlap } = await import('../eda/obstacle-router.mjs');
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const model = groupedModel(), projection = projectModel(model, { labels: 'off', bundle: false });
  const before = JSON.stringify({ model, projection }), calls = [], engine = new ELK();
  const seed = await arrangeDomainGroups(projection, { layout: async graph => { calls.push(graph); return engine.layout(graph); } });
  assert.equal(calls.length, 3, 'two inner domain graphs followed by the coarse domain graph');
  assert(calls.slice(0, 2).every(graph => graph.children.every(node => node.id.startsWith('table:'))));
  assert(calls[2].children.every(node => node.id.startsWith('domain-layout:')));
  assert.equal(seed.groupLayout.strategy, 'two-stage-domains');
  assert.equal(seed.children.length, projection.nodes.length);
  assert(!rectanglesOverlap(seed.domainGroups[0], seed.domainGroups[1]));
  for (const group of seed.domainGroups) for (const id of group.nodeIds) {
    const node = seed.children.find(n => n.id === id);
    assert(node.x >= group.x && node.y >= group.y && node.x + node.width <= group.x + group.width && node.y + node.height <= group.y + group.height);
  }
  const layout = await routeDiagramGeometry(projection, seed);
  validateLayout(layout, projection);
  assert.deepEqual(layout.edges.map(e => [e.id, e.sources, e.targets]), projection.edges.map(e => [e.id, e.sources, e.targets]));
  assert.equal(JSON.stringify({ model, projection }), before);
});

test('virtual bus and reference nodes belong to adjacent table domains without rewriting edges', async () => {
  const { domainLayoutGroups } = await import('../eda/group-layout.mjs');
  const nodes = [{ id: 'a', kind: 'table', tableId: 'a', ports: [{ id: 'a-port' }] },
    { id: 'b', kind: 'table', tableId: 'b', ports: [{ id: 'b-port' }] },
    { id: 'hub', kind: 'hub', ports: [{ id: 'in' }, { id: 'out' }] },
    { id: 'label', kind: 'label', ports: [{ id: 'label-port' }] }];
  const projection = { nodes, domains: [{ id: 'a-domain', tableIds: ['a'] }, { id: 'b-domain', tableIds: ['b'] }],
    edges: [{ sources: ['a-port'], targets: ['in'] }, { sources: ['out'], targets: ['a-port'] }, { sources: ['label-port'], targets: ['b-port'] }] };
  const before = JSON.stringify(projection), groups = domainLayoutGroups(projection);
  assert.deepEqual(groups.find(g => g.id === 'a-domain').nodeIds, ['a', 'hub']);
  assert.deepEqual(groups.find(g => g.id === 'b-domain').nodeIds, ['b', 'label']);
  assert.equal(JSON.stringify(projection), before);
});

test('expired and large grouped requests start no optional global layout work', async () => {
  const { projectModel } = await import('../eda/model.mjs');
  const { arrangeDomainGroups, domainLayoutEligibility } = await import('../eda/group-layout.mjs');
  const projection = projectModel(groupedModel(), { labels: 'off', bundle: false });
  const engine = { layout: async () => assert.fail('optional stage must not launch') };
  assert.equal(await arrangeDomainGroups(projection, engine, { budget: { expired: () => true } }), null);
  const large = { ...projection, nodes: Array.from({ length: 81 }, (_, i) => ({ id: i, kind: 'table', ports: [] })) };
  assert.equal(domainLayoutEligibility(large).reason, 'size');
  assert.equal(await arrangeDomainGroups(large, engine), null);
  let calls = 0;
  const budget = { expired: () => calls > 0 };
  const partial = { layout: async graph => { calls++; return { ...graph, children: graph.children.map((n, i) => ({ ...n, x: i * 500, y: 0 })),
    edges: graph.edges.map(e => ({ ...e, sections: [{ startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 0 } }] })) }; } };
  assert.equal(await arrangeDomainGroups(projection, partial, { budget }), null);
  assert.equal(calls, 1);
});

test('grouped candidate participates alongside validated baselines with its own diagnostics', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const { validateLayout } = await import('../eda/metrics.mjs');
  const { compareCandidates } = await import('../eda/layout-quality.mjs');
  const model = groupedModel(), before = JSON.stringify(model);
  const result = await arrangeSchematic(model, { labels: 'off', bundle: false, refinePositions: false });
  validateLayout(result.layout, result.projection);
  assert.equal(result.status, 'ready');
  assert(result.candidates.some(c => !c.optimization), 'the original ELK baseline remains available');
  assert(result.candidates.some(c => c.groupLayout?.strategy === 'two-stage-domains'));
  assert(result.diagnostics.groupLayout.candidates > 0);
  assert.deepEqual(new Set(result.projection.covered), new Set(model.relationships.map(r => r.id)));
  for (const candidate of result.candidates) assert(compareCandidates(result, candidate) <= 0);
  assert.equal(JSON.stringify(model), before);
});
