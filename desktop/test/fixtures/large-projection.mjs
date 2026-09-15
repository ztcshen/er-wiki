// 40 referenced dimensions and two consumers: 42 tables, 81 relationships.
// Each dimension has a 2-member bus, so the projection adds 40 junctions.
export function largeProjectionModel() {
  const dimensions = Array.from({ length: 40 }, (_, index) => ({ id: `dimension-${index}`, name: `dimension_${index}`, fields: [{ id: 'id', name: 'id', primary: true }] }));
  const consumers = ['a', 'b'].map(id => ({ id, name: id, fields: [{ id: 'id', name: 'id', primary: true }, ...dimensions.map(table => ({ id: table.id, name: table.name + '_id' }))] }));
  const relationships = consumers.flatMap(table => dimensions.map(dimension => ({ id: `${table.id}-${dimension.id}`, startTableId: table.id, startFieldId: dimension.id, endTableId: dimension.id, endFieldId: 'id', cardinality: 'many_to_one' })));
  consumers[1].fields.push({ id: 'a_id', name: 'a_id' });
  relationships.push({ id: 'b-a', startTableId: 'b', startFieldId: 'a_id', endTableId: 'a', endFieldId: 'id', cardinality: 'many_to_one' });
  return { tables: [...dimensions, ...consumers], relationships, groups: [] };
}
