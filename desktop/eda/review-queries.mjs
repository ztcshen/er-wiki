const TARGETS = ['tables', 'fields', 'relationships'];
const STATUSES = ['any', 'candidate', 'confirmed', 'unresolved'];
const NATURES = ['any', 'physical', 'logical', 'inferred', 'unspecified'];
const DOCUMENTATION = ['any', 'missing', 'present'];
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 120;
export const BUILTIN_QUERIES = [
  { id: 'builtin:candidates', name: '待确认关系', target: 'relationships', filters: { status: 'candidate' } },
  { id: 'builtin:undocumented-fields', name: '未补字段说明', target: 'fields', filters: { documentation: 'missing' } },
  { id: 'builtin:unresolved', name: '异常关联', target: 'relationships', filters: { status: 'unresolved' } },
];
export function cleanReviewQuery(value) {
  const f = value?.filters || {};
  return { id: value?.id, name: String(value?.name || '').trim(), target: value?.target,
    filters: { status: f.status ?? 'any', nature: f.nature ?? 'any', documentation: f.documentation ?? 'any',
      groupId: f.groupId ?? null, text: f.text ?? '' } };
}
export function validateReviewQueries(queries) {
  if (queries === undefined) return;
  if (!Array.isArray(queries) || queries.length > 100) throw Error('审查查询需要是最多 100 项的数组');
  const ids = new Set();
  for (const raw of queries) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.name !== 'string') throw Error('审查查询定义无效');
    const q = cleanReviewQuery(raw), f = q.filters;
    if (!validId(q.id) || q.id.startsWith('builtin:') || ids.has(q.id) || !q.name || q.name.length > 120 || !TARGETS.includes(q.target) ||
      !STATUSES.includes(f.status) || !NATURES.includes(f.nature) || !DOCUMENTATION.includes(f.documentation) ||
      !(f.groupId === null || typeof f.groupId === 'string' && f.groupId.length <= 1000 || typeof f.groupId === 'number' && Number.isFinite(f.groupId)) ||
      typeof f.text !== 'string' || f.text.length > 300 || !raw || Object.keys(raw).some(k => !['id', 'name', 'target', 'filters'].includes(k)) ||
      raw.filters && (typeof raw.filters !== 'object' || Array.isArray(raw.filters) || Object.keys(raw.filters).some(k => !['status', 'nature', 'documentation', 'groupId', 'text'].includes(k))))
      throw Error('审查查询定义无效');
    ids.add(q.id);
  }
}
export function runReviewQuery(raw, model, index) {
  if (!index?.ready) return [];
  const query = cleanReviewQuery(raw), f = query.filters, terms = f.text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const members = f.groupId === null ? null : new Set(model.groups.find(g => g.id === f.groupId)?.tableIds || []);
  const inScope = id => !members || members.has(id);
  const documented = has => f.documentation === 'any' || (f.documentation === 'present' ? has : !has);
  const matches = text => terms.every(term => text.toLowerCase().includes(term));
  const tableEntries = new Map(index.tables.map(t => [t.tableId, t]));
  if (query.target !== 'relationships') return model.tables.flatMap(table => {
    if (!inScope(table.id)) return [];
    const entry = tableEntries.get(table.id); if (!entry) return [];
    if (query.target === 'tables') return documented(entry.documented) && matches(entry.text) ? [{ type: 'table', tableId: table.id }] : [];
    return entry.fields.filter(field => documented(field.documented) && matches(field.text)).map(field => ({ type: 'field', tableId: table.id, fieldId: field.fieldId }));
  });
  const known = new Map(model.relationships.map(r => [r.id, r]));
  return index.references.filter(r => {
    const original = known.get(r.id); if (!original || !(inScope(r.source) || inScope(r.target))) return false;
    if (f.status === 'unresolved' ? r.valid : f.status !== 'any' && r.status !== f.status) return false;
    if (f.nature !== 'any' && r.nature !== f.nature) return false;
    return documented(Boolean(String(original.reviewEvidence?.description || original.comment || '').trim())) &&
      matches([original.name, original.reviewEvidence?.description, r.source, r.target, ...r.problems].join(' '));
  }).map(r => ({ type: 'relationship', relationshipId: r.id, tableId: r.source, status: r.status, valid: r.valid }));
}
