const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = (paths, shared = false) => ({
  layout: { children: [], edges: paths.map((points, id) => ({ id, sections: [{ startPoint: points[0], endPoint: points[1] }] })) },
  projection: { nodes: [], edges: paths.map((_, id) => ({ id, netIds: [shared ? 'bus' : id], sources: [], targets: [] })) },
});
test('crossings, disjoint-net overlaps and unconnected T contacts are distinct', async () => {
  const { scoreLayout } = await import('../eda/metrics.mjs');
  const horizontal = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  const run = (other, shared) => { const { layout, projection } = fixture([horizontal, other], shared); return scoreLayout(layout, projection); };
  assert.equal(run([{ x: 50, y: -10 }, { x: 50, y: 10 }]).crossings, 1);
  assert.equal(run([{ x: 50, y: 0 }, { x: 50, y: 10 }]).illegalContacts, 1);
  assert.equal(run([{ x: 30, y: 0 }, { x: 70, y: 0 }]).collinearConflicts, 1);
  assert.equal(run([{ x: 30, y: 0 }, { x: 70, y: 0 }], true).collinearConflicts, 0);
});
test('same endpoint coordinates do not imply a connection without shared semantic identity', async () => {
  const { scoreLayout } = await import('../eda/metrics.mjs');
  const { layout, projection } = fixture([[{ x: 0, y: 0 }, { x: 50, y: 0 }], [{ x: 50, y: 0 }, { x: 50, y: 30 }]]);
  layout.children = [{ id: 'owner', x: 50, y: 0, width: 10, height: 10 }];
  projection.nodes = [{ id: 'owner', ports: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: 0 }] }];
  projection.edges[0].targets = ['a']; projection.edges[1].sources = ['b'];
  assert.equal(scoreLayout(layout, projection).illegalContacts, 1);
  projection.nodes[0].ports.forEach(port => { port.aggregateId = 'declared-summary'; });
  assert.equal(scoreLayout(layout, projection).illegalContacts, 0);
});
