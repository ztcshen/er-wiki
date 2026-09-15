const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = { tables: ['a', 'b'].map(id => ({ id, name: id, fields: [{ id: 'id', name: 'id' }] })), relationships: [], groups: [] };
const placed = graph => ({ ...graph, width: 900, height: 200, children: graph.children.map((node, index) => ({ ...node, x: index * 450, y: 0 })) });

test('later candidate exceptions preserve an earlier valid result', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  let calls = 0;
  const result = await arrangeSchematic(model, { labels: 'off', optimize: false }, { layout: async graph => {
    if (calls++ > 0) throw new Error('synthetic candidate failure'); return placed(graph);
  } });
  assert.equal(result.status, 'ready'); assert.equal(calls, 4);
  assert.equal(result.diagnostics.candidateErrors.length, 3);
  assert.equal(result.projection.nodes.length, 2);
  await assert.rejects(arrangeSchematic(model, { labels: 'off', optimize: false }, { layout: async () => { throw new Error('all failed'); } }), error => error.code === 'LAYOUT_NO_CANDIDATE' && error.candidateErrors.length === 4);
});

test('one shared deadline stops further candidates and optional optimization', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  let clock = 0, calls = 0;
  const result = await arrangeSchematic(model, { labels: 'off', now: () => clock, softBudgetMs: 10 }, { layout: async graph => {
    calls++; clock = 11; return placed(graph);
  } });
  assert.equal(calls, 1); assert.equal(result.status, 'ready');
  assert.equal(result.diagnostics.stopReason, 'budget');
});

test('expired compaction budget launches no engine work', async () => {
  const { compactLayoutSeeds } = await import('../eda/compact-layout.mjs');
  const result = await compactLayoutSeeds({ nodes: [{}, {}], level: 'column' }, { children: [{}, {}] }, { layout: async () => assert.fail('must not start') }, { budget: { expired: () => true } });
  assert.deepEqual(result, []);
});
