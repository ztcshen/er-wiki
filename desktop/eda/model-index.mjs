import { isCandidateRelation, resolveRelationSemantics } from '../review/relation-semantics.mjs';

export const indexId = value => JSON.stringify(value);
const fold = values => values.map(value => String(value ?? '')).join(' ').toLowerCase();
const described = item => Boolean(String(item?.comment || item?.reviewChineseName || '').trim());
const cancelled = () => Object.assign(new Error('已取消索引更新'), { code: 'INDEX_CANCELLED' });
const descriptor = table => [table.id, table.name, table.comment, table.reviewChineseName,
  (table.fields || []).map(f => [f.id, f.name, f.comment, f.reviewChineseName, f.reviewEnumValues, f.type, f.values])];
export const modelIndexKey = model => JSON.stringify([model.tables.map(descriptor), model.relationships]);

// Content-derived records contain search text and identifiers, never an editable
// copy of a table. Model identity and relationship resolution live separately.
export function createModelIndexEngine({ maxEntries = 2048, maxBytes = 16 * 1024 * 1024 } = {}) {
  const contents = new Map(); let used = 0;
  const remember = (key, entry) => {
    const bytes = key.length * 2 + JSON.stringify(entry).length * 2;
    if (bytes > maxBytes) return;
    contents.set(key, { entry, bytes }); used += bytes;
    while (contents.size > maxEntries || used > maxBytes) { const first = contents.keys().next().value; used -= contents.get(first).bytes; contents.delete(first); }
  };
  return {
    async build(model, { current = () => true, yieldWork = () => new Promise(resolve => setTimeout(resolve, 0)), onPhase = () => {} } = {}) {
      const check = () => { if (!current()) throw cancelled(); };
      check();
      const tables = [], identities = new Map(), stats = { hits: 0, misses: 0 };
      onPhase({ phase: 'tables', completed: 0, total: model.tables.length });
      for (const [i, table] of model.tables.entries()) {
        check(); const key = JSON.stringify(descriptor(table)), cached = contents.get(key); let entry;
        if (cached) { stats.hits++; contents.delete(key); contents.set(key, cached); entry = cached.entry; }
        else { stats.misses++; entry = { tableId: table.id, text: fold([table.name, table.comment, table.reviewChineseName]), documented: described(table),
          fields: (table.fields || []).map(field => ({ fieldId: field.id, documented: described(field),
            text: fold([`${table.name}.${field.name}`, field.name, field.comment, field.reviewChineseName, ...(field.reviewEnumValues || []).flatMap(v => [v.value, v.label])]) })) }; remember(key, entry); }
        tables.push(entry); identities.set(table.id, new Set((table.fields || []).map(f => f.id)));
        if (i % 64 === 63) { onPhase({ phase: 'tables', completed: i + 1, total: model.tables.length }); await yieldWork(); }
      }
      check(); await yieldWork(); check();
      const references = [], incoming = {}, outgoing = {}, fields = {};
      const add = (map, key, rid) => { const values = map[key] ||= []; if (!values.includes(rid)) values.push(rid); };
      onPhase({ phase: 'references', completed: 0, total: model.relationships.length });
      const tableMap = new Map(model.tables.map(t => [t.id, t]));
      for (const [i, relation] of model.relationships.entries()) {
        check(); const pairs = relation.fields?.length ? relation.fields : [{ startFieldId: relation.startFieldId, endFieldId: relation.endFieldId }];
        const problems = [];
        if (!identities.has(relation.startTableId)) problems.push('源表不存在');
        if (!identities.has(relation.endTableId)) problems.push('目标表不存在');
        for (const pair of pairs) {
          if (identities.has(relation.startTableId) && !identities.get(relation.startTableId).has(pair.startFieldId)) problems.push('源字段不存在');
          if (identities.has(relation.endTableId) && !identities.get(relation.endTableId).has(pair.endFieldId)) problems.push('目标字段不存在');
          add(fields, indexId([relation.startTableId, pair.startFieldId]), relation.id);
          add(fields, indexId([relation.endTableId, pair.endFieldId]), relation.id);
        }
        const semantic = resolveRelationSemantics(relation, tableMap.get(relation.startTableId));
        problems.push(...semantic.errors.map(e => e.message));
        references.push({ id: relation.id, source: relation.startTableId, target: relation.endTableId,
          status: isCandidateRelation(relation) ? 'candidate' : 'confirmed', nature: semantic.kind,
          valid: !problems.length, problems: [...new Set(problems)] });
        add(outgoing, indexId(relation.startTableId), relation.id); add(incoming, indexId(relation.endTableId), relation.id);
        if (i % 128 === 127) { onPhase({ phase: 'references', completed: i + 1, total: model.relationships.length }); await yieldWork(); }
      }
      check(); await yieldWork(); check();
      onPhase({ phase: 'ready', completed: references.length, total: references.length });
      return { version: 1, tables, references, incoming, outgoing, fields,
        stats: { ...stats, retainedContents: contents.size, tableCount: tables.length, referenceCount: references.length,
          unresolved: references.filter(r => !r.valid).length }, ready: true };
    },
    clear() { contents.clear(); used = 0; },
  };
}

export function searchModelIndex(index, model, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean); if (!terms.length || !index?.ready) return [];
  const known = new Map(model.tables.map(t => [t.id, t])), result = [];
  for (const entry of index.tables) {
    const table = known.get(entry.tableId); if (!table) continue;
    if (terms.every(t => entry.text.includes(t))) result.push({ table, field: null });
    for (const item of entry.fields) if (terms.every(t => item.text.includes(t))) { const field = table.fields.find(f => f.id === item.fieldId); if (field) result.push({ table, field }); }
  }
  return result;
}

export function objectReferences(index, tableId, fieldId = null) {
  if (!index?.ready) return { incoming: [], outgoing: [] };
  const filtered = fieldId == null ? null : new Set(index.fields[indexId([tableId, fieldId])] || []);
  const select = ids => index.references.filter(r => ids.includes(r.id) && (!filtered || filtered.has(r.id)));
  return { incoming: select(index.incoming[indexId(tableId)] || []), outgoing: select(index.outgoing[indexId(tableId)] || []) };
}
