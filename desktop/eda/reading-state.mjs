export const LEVELS = ['overview', 'system', 'domain', 'table', 'column'];
const isId = value => typeof value === 'string' && value.length < 1000 || typeof value === 'number' && Number.isFinite(value);
export const validView = v => Array.isArray(v) && v.length === 4 && v.every(Number.isFinite) &&
  Math.abs(v[0]) <= 1e8 && Math.abs(v[1]) <= 1e8 && v[2] >= 100 && v[3] > 0 && v[2] <= 1e7 && v[3] <= 1e7;

export function cleanLocation(value = {}) {
  const level = LEVELS.includes(value.level) ? value.level : 'overview';
  return { level, domainId: ['overview', 'system'].includes(level) ? '' : (isId(value.domainId) ? value.domainId : ''),
    tableId: ['table', 'column'].includes(level) && isId(value.tableId) ? value.tableId : null,
    selectedTable: isId(value.selectedTable) ? value.selectedTable : null,
    selectedField: isId(value.selectedField) ? value.selectedField : null,
    selectedNet: typeof value.selectedNet === 'string' ? value.selectedNet.slice(0, 2000) : null,
    expanded: Array.isArray(value.expanded) ? value.expanded.filter(x => typeof x === 'string').slice(0, 100) : [],
    labels: ['off', 'auto', 'all'].includes(value.labels) ? value.labels : 'off',
    bundle: value.bundle !== false,
    direction: ['RIGHT', 'DOWN'].includes(value.direction) ? value.direction : 'AUTO' };
}

export const scopeKey = value => {
  const v = cleanLocation(value);
  const key = [v.level, v.domainId, v.tableId, v.labels, v.bundle, v.expanded];
  // Keep existing AUTO keys so upgrades retain saved reading positions.
  if (v.direction !== 'AUTO') key.push(v.direction);
  return JSON.stringify(key);
};

export function normalizeReadingState(value) {
  const v = value && typeof value === 'object' ? value : {};
  const views = Object.fromEntries(Object.entries(v.views || {}).filter(([k, view]) => k.length < 10000 && validView(view)).slice(-60));
  const bookmarks = (Array.isArray(v.bookmarks) ? v.bookmarks : []).filter(b => b && typeof b.id === 'string' && typeof b.name === 'string')
    .slice(-50).map(b => ({ id: b.id.slice(0, 100), name: b.name.slice(0, 120), location: cleanLocation(b.location),
      view: validView(b.view) ? b.view : null }));
  const collapsedDomains = Array.isArray(v.collapsedDomains) ? [...new Set(v.collapsedDomains.filter(isId))].slice(0, 2000) : [];
  return { version: 1, location: cleanLocation(v.location), views, bookmarks, collapsedDomains };
}

export function restoreLocation(value, model) {
  const location = cleanLocation(value);
  const ids = new Set(model.tables.map(t => t.id));
  if (location.tableId !== null && !ids.has(location.tableId)) return cleanLocation({ labels: location.labels, bundle: location.bundle, direction: location.direction });
  if (location.level === 'domain' && location.domainId !== '__unassigned__' && !model.groups.some(g => g.id === location.domainId))
    return cleanLocation({ labels: location.labels, bundle: location.bundle, direction: location.direction });
  if (!ids.has(location.selectedTable)) { location.selectedTable = null; location.selectedField = null; }
  if (location.selectedField !== null && !model.tables.find(t => t.id === location.selectedTable)?.fields.some(f => f.id === location.selectedField)) location.selectedField = null;
  return location;
}

export const readingKey = modelId => `erwiki.reader.v1.${encodeURIComponent(modelId)}`;
export function loadReadingState(storage, modelId) {
  try { return normalizeReadingState(JSON.parse(storage.getItem(readingKey(modelId)) || '{}')); }
  catch { return normalizeReadingState({}); }
}
export function saveReadingState(storage, modelId, state) {
  storage.setItem(readingKey(modelId), JSON.stringify(normalizeReadingState(state)));
}

export function searchModel(model, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const result = [];
  for (const table of model.tables) {
    const contains = values => { const text = values.map(v => String(v ?? '')).join(' ').toLocaleLowerCase(); return terms.every(term => text.includes(term)); };
    if (contains([table.name, table.comment, table.reviewChineseName])) result.push({ table, field: null });
    for (const field of table.fields) if (contains([`${table.name}.${field.name}`, field.name, field.comment, field.reviewChineseName,
      ...(field.reviewEnumValues || []).flatMap(v => [v.value, v.label])])) result.push({ table, field });
  }
  return result;
}
