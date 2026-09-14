const { test } = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('./fixtures/conditional-model.mjs'), import('../eda/model.mjs'), import('../eda/layout.mjs')]);

test('conditional branches stay direct, separately ported and labeled with all label/bundle settings', async () => {
  const [{ conditionalModel }, { projectModel }] = await modules;
  const model = conditionalModel(), before = JSON.stringify(model);
  for (const labels of ['off', 'auto', 'all']) for (const bundle of [true, false]) {
    const p = projectModel(model, { level: 'overview', labels, bundle });
    const branches = p.edges.filter(e => e.kind === 'conditional');
    assert.equal(branches.length, 3);
    assert.equal(new Set(branches.flatMap(e => e.targets)).size, 3);
    const inbox = p.nodes.find(n => n.tableId === 'notifications');
    assert.equal(new Set(inbox.ports.map(p => p.y)).size, 3);
    for (const edge of branches) {
      assert.equal(edge.refs.length, 1);
      assert.equal(p.edges.filter(e => e.refs.includes(edge.refs[0])).length, 1);
      assert.match(edge.labels[0].text, /^business_type = (CREDIT|FINANCING|REPAYMENT)$/);
      assert(p.nodes.some(n => n.kind === 'table' && n.ports.some(p => edge.sources.includes(p.id))));
    }
    assert.equal(p.covered.length, model.relationships.length);
    if (labels === 'off' && bundle) assert(p.edges.some(e => e.kind === 'bus'), 'Ordinary FKs still bundle');
  }
  assert.equal(JSON.stringify(model), before);
});

test('domain filtering retains boundary labels without silently adding hidden business tables', async () => {
  const [{ conditionalModel }, { projectModel }] = await modules;
  const p = projectModel(conditionalModel(), { level: 'domain', domainId: 'inbox', labels: 'off' });
  assert.equal(p.nodes.filter(n => n.kind === 'table').length, 1);
  assert.equal(p.covered.length, 3);
  assert(p.edges.every(e => e.kind === 'label-stub'));
});

test('ELK places conditional labels and never cuts their full-view paths for length', async () => {
  const [{ conditionalModel }, , { arrangeSchematic }] = await modules;
  const result = await arrangeSchematic(conditionalModel(), { level: 'overview', labels: 'auto', bundle: true, longThreshold: 1 });
  const branches = result.projection.edges.filter(e => e.kind === 'conditional');
  assert.equal(branches.length, 3);
  assert.equal(result.metrics.overlaps, 0);
  const { cardinalityBadges } = await import('../eda/cardinality.mjs');
  const inboxBadges = cardinalityBadges(result).filter(b => b.tableId === 'notifications');
  assert(inboxBadges.length >= 1 && inboxBadges.length <= 4, 'Conditional leads share one badge per side');
  assert.equal(new Set(inboxBadges.map(b => b.side)).size, inboxBadges.length);
  assert.equal(new Set(inboxBadges.flatMap(b => b.refs)).size, 3);
  assert(inboxBadges.every(b => b.value === 'N'));
  for (const branch of branches) {
    const edge = result.layout.edges.find(e => e.id === branch.id);
    assert(edge.sections.length > 0);
    assert.equal(edge.labels.length, 1);
    assert([edge.labels[0].x, edge.labels[0].y, edge.labels[0].width, edge.labels[0].height].every(Number.isFinite));
  }
});

test('condition appears in hover caption and survives presentation refresh', async () => {
  const [{ conditionalModel }, , { arrangeSchematic }] = await modules;
  const { relationCaption } = await import('../eda/cardinality.mjs');
  const { refreshLayoutContent, geometryKey } = await import('../eda/layout-content.mjs');
  const model = conditionalModel(), relation = model.relationships.find(r => r.id === 'notice-CREDIT');
  assert.match(relationCaption(relation, id => id), /business_type = CREDIT/);
  const result = await arrangeSchematic(model, { level: 'overview', labels: 'off' });
  assert(refreshLayoutContent(result, model).projection.nets.some(n => n.name.includes('business_type = CREDIT')));
  const oldKey = geometryKey(model, {});
  relation.reviewEvidence.condition.value = 'CHANGED';
  assert.notEqual(geometryKey(model, {}), oldKey);
});
