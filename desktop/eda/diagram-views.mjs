const object = value => value && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 1000 || typeof value === 'number' && Number.isSafeInteger(value);
const assert = (condition, path, reason) => { if (!condition) throw new Error(`${path}: ${reason}`); };

// A view contains references and presentation state, never copied table definitions.
export function validateDiagramViews(views, tables = []) {
  if (views === undefined) return;
  assert(Array.isArray(views), 'diagramViews', 'expected an array');
  const known = new Map(tables.map(table => [table.id, table])), ids = new Set();
  for (const [index, view] of views.entries()) {
    const path = `diagramViews[${index}]`;
    assert(object(view), path, 'expected a view');
    assert(typeof view.id === 'string' && view.id.length > 0 && view.id.length <= 120 && !ids.has(view.id), `${path}.id`, 'expected a unique view ID');
    ids.add(view.id);
    assert(typeof view.name === 'string' && view.name.trim().length > 0 && view.name.length <= 120, `${path}.name`, 'expected a view name');
    assert(view.description === undefined || typeof view.description === 'string' && view.description.length <= 4000, `${path}.description`, 'invalid description');
    assert(Array.isArray(view.depicts), `${path}.depicts`, 'expected table references');
    const members = new Set();
    for (const [i, depict] of view.depicts.entries()) {
      const at = `${path}.depicts[${i}]`;
      assert(object(depict) && Object.keys(depict).every(key => ['tableId', 'x', 'y', 'hiddenFieldIds', 'color'].includes(key)), at, 'expected a table reference and presentation state');
      assert(id(depict.tableId) && known.has(depict.tableId) && !members.has(depict.tableId), `${at}.tableId`, 'unknown or duplicated table');
      members.add(depict.tableId);
      assert((depict.x === undefined && depict.y === undefined) || [depict.x, depict.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1e7), at, 'coordinates must be a finite nonnegative pair');
      assert(depict.color === undefined || typeof depict.color === 'string' && /^#[\da-f]{6}$/i.test(depict.color), `${at}.color`, 'invalid color');
      const fields = new Set(known.get(depict.tableId).fields.map(field => field.id));
      assert(depict.hiddenFieldIds === undefined || Array.isArray(depict.hiddenFieldIds) && depict.hiddenFieldIds.every(fid => fields.has(fid)) && new Set(depict.hiddenFieldIds).size === depict.hiddenFieldIds.length, `${at}.hiddenFieldIds`, 'unknown or duplicated field');
    }
  }
}

export function reconcileDiagramViews(views = [], tables = []) {
  const known = new Map(tables.map(table => [table.id, table]));
  return views.map(view => ({ ...view, depicts: view.depicts.filter(d => known.has(d.tableId)).map(d => ({ ...d,
    ...(d.hiddenFieldIds ? { hiddenFieldIds: d.hiddenFieldIds.filter(id => known.get(d.tableId).fields.some(f => f.id === id)) } : {}),
  })) }));
}

export function captureViewGeometry(view, result) {
  const meta = new Map(result.projection.nodes.filter(n => n.kind === 'table').map(n => [n.id, n.tableId]));
  const positions = new Map(result.layout.children.filter(n => meta.has(n.id)).map(n => [meta.get(n.id), n]));
  return { ...view, depicts: view.depicts.map(depict => {
    const position = positions.get(depict.tableId);
    return position ? { ...depict, x: position.x, y: position.y } : depict;
  }) };
}

export function moveViewDepict(view, result, tableId, x, y) {
  const captured = captureViewGeometry(view, result);
  return { ...captured, depicts: captured.depicts.map(d => d.tableId === tableId
    ? { ...d, x: Math.min(1e7, Math.max(40, x)), y: Math.min(1e7, Math.max(40, y)) } : d) };
}

export function resetViewGeometry(view) {
  return { ...view, depicts: view.depicts.map(({ x, y, ...rest }) => rest) };
}
