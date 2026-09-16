const { test } = require('node:test');
const assert = require('node:assert/strict');
const cardinality = import('../eda/cardinality.mjs');
const modelModule = import('../eda/model.mjs');
const layoutModule = import('../eda/layout.mjs');
const fixture = values => ({ tables: [{ id: 'parent', name: 'orders', fields: [{ id: 'pk', name: 'id', primary: true, type: 'BIGINT' }] },
  ...values.map((_, i) => ({ id: `child${i}`, name: `items${i}`, fields: [{ id: 'fk', name: 'order_id', type: 'BIGINT' }] }))],
  relationships: values.map((value, i) => ({ id: `r${i}`, startTableId: `child${i}`, startFieldId: 'fk', endTableId: 'parent', endFieldId: 'pk', cardinality: value })), groups: [] });
const arrange = async (model, options = {}) => (await layoutModule).arrangeSchematic(model, { level: 'overview', labels: 'off', direction: 'RIGHT', ...options });

test('bundle count moves away from an obstacle instead of overprinting it', async () => {
  const {bundleBadges}=await cardinality;
  const result={projection:{nodes:[],nets:[],edges:[{id:'bus',kind:'bus',refs:['a','b'],netIds:[],sources:[],targets:[]}]},
    layout:{children:[{id:'obstacle',x:60,y:65,width:80,height:30}],edges:[{id:'bus',sections:[{startPoint:{x:0,y:100},endPoint:{x:200,y:100}}]}]}};
  const before=JSON.stringify(result),[badge]=bundleBadges(result);
  assert.equal(badge.count,2);
  assert(!(badge.x-32<140&&badge.x+32>60&&badge.y-8<95&&badge.y+8>65));
  assert.equal(JSON.stringify(result),before);
});

test('cardinality follows original relationship endpoints, never graph direction or optionality', async () => {
  const { cardinalityOf, cardinalityBadges } = await cardinality;
  assert.deepEqual(cardinalityOf({ cardinality: 'one_to_many' }), { start: '1', end: 'N', name: '一对多' });
  assert.equal(cardinalityOf({}).start, '?');
  for (const direction of ['RIGHT', 'DOWN']) {
    const model = fixture(['many_to_one', 'one_to_one', 'one_to_many', 'many_to_many', undefined]);
    const before = JSON.stringify(model), result = await arrange(model, { direction, bundle: false });
    const badges = cardinalityBadges(result);
    for (const relation of model.relationships) {
      const badge = badges.find(item => item.tableId === relation.startTableId);
      assert.equal(badge.value, cardinalityOf(relation).start);
    }
    assert.equal(badges.find(item => item.tableId === 'parent').value, '混合');
    assert.equal(JSON.stringify(model), before);
  }
});

test('shared buses count relationships; only real table endpoints receive cardinality', async () => {
  const { cardinalityBadges, bundleBadges } = await cardinality;
  const result = await arrange(fixture(['many_to_one', 'many_to_one', 'one_to_many', 'one_to_one']));
  assert(result.projection.nodes.some(node => node.kind === 'hub'));
  assert.equal(bundleBadges(result)[0].count, 4);
  const normal = cardinalityBadges(result);
  assert.equal(normal.length, 5); assert.equal(normal.find(item => item.tableId === 'parent').value, '混合');
  assert.equal(cardinalityBadges(result, 'r0').find(item => item.tableId === 'parent').value, '1');
  assert.equal(cardinalityBadges(result, 'r2').find(item => item.tableId === 'parent').value, 'N');
  assert(normal.every(item => Number.isFinite(item.x) && Number.isFinite(item.y)));
});

test('Net Labels retain individual member identity and highlight only that member plus its shared stub', async () => {
  const { cardinalityBadges, nodeRelations, matchesRelation, relationBounds } = await cardinality;
  const result = await arrange(fixture(['many_to_one', 'one_to_one']), { labels: 'all' });
  const badges = cardinalityBadges(result);
  assert.equal(badges.find(item => item.tableId === 'child0').value, 'N');
  assert.equal(badges.find(item => item.tableId === 'child1').value, '1');
  const refs = nodeRelations(result.projection), labels = result.projection.nodes.filter(node => node.kind === 'label');
  assert.equal(labels.filter(node => refs.get(node.id).length === 1).length, 2);
  const highlighted = result.projection.edges.filter(edge => matchesRelation(edge, result.projection.nets[0].id, 'r0'));
  assert.equal(highlighted.length, 2); assert(highlighted.every(edge => edge.refs.includes('r0')));
  const bounds = relationBounds(result, 'r0');
  for (const label of labels.filter(node => refs.get(node.id).includes('r0'))) {
    const geometry = result.layout.children.find(node => node.id === label.id);
    assert(bounds.x <= geometry.x && bounds.x + bounds.width >= geometry.x + geometry.width);
    assert(bounds.y <= geometry.y && bounds.y + bounds.height >= geometry.y + geometry.height);
  }
});

test('self relations distinguish start and end ports even on the same table', async () => {
  const { cardinalityBadges } = await cardinality;
  const model = { tables: [{ id: 'self', name: 'categories', fields: [{ id: 'pk', name: 'id', primary: true }, { id: 'fk', name: 'parent_id' }] }],
    relationships: [{ id: 'self-ref', startTableId: 'self', startFieldId: 'fk', endTableId: 'self', endFieldId: 'pk', cardinality: 'many_to_one' }], groups: [] };
  const result = await arrange(model);
  assert.deepEqual(cardinalityBadges(result).map(item => item.value).sort(), ['1', 'N']);
});

test('collapsed and composite ports do not overprint badges; domain links never claim a row cardinality', async () => {
  const { cardinalityBadges } = await cardinality;
  const model = fixture(['many_to_one']);
  model.tables.forEach(table => table.fields.push({ id: 'second', name: 'tenant_id' }));
  model.relationships[0].fields = [{ startFieldId: 'fk', endFieldId: 'pk' }, { startFieldId: 'second', endFieldId: 'second' }];
  model.groups = [{ id: 'a', name: 'A', tableIds: ['parent'] }, { id: 'b', name: 'B', tableIds: ['child0'] }];
  assert.equal(cardinalityBadges(await arrange(model, { level: 'domain' })).length, 2);
  assert.equal(cardinalityBadges(await arrange(model, { level: 'system' })).length, 0);
});

test('editing cardinality refreshes annotation content without rerouting or changing reading scope keys', async () => {
  const { cardinalityBadges, relationCaption } = await cardinality;
  const { geometryKey, refreshLayoutContent } = await import('../eda/layout-content.mjs');
  const { scopeKey, normalizeReadingState, restoreLocation } = await import('../eda/reading-state.mjs');
  const model = fixture(['many_to_one']), options = { level: 'overview', labels: 'off', bundle: true };
  const before = geometryKey(model, options), result = await arrange(model);
  model.relationships[0].cardinality = 'one_to_many';
  const refreshed = refreshLayoutContent(result, model);
  assert.equal(geometryKey(model, options), before); assert.equal(refreshed.layout, result.layout);
  assert.equal(cardinalityBadges(refreshed).find(item => item.tableId === 'parent').value, 'N');
  assert.equal(scopeKey({ selectedRelation: 'r0' }), scopeKey({}));
  assert.equal(normalizeReadingState({ location: { selectedRelation: 'r0' } }).location.selectedRelation, 'r0');
  assert.equal(restoreLocation({ selectedRelation: 'deleted' }, model).selectedRelation, null);
  assert.match(relationCaption(model.relationships[0], id => id), /child0 \(1\) — \(N\) parent/);
});
