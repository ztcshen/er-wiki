import { useMemo } from 'react';
import { BUILTIN_QUERIES, runReviewQuery } from './review-queries.mjs';
import { tr } from '../i18n/renderer';

export default function ReviewQueries({ model, index, queryId, onSelect, onEdit, onNew, onLocate, readOnly }) {
  const queries = [...BUILTIN_QUERIES, ...(model.reviewQueries || [])], query = queries.find(q => q.id === queryId) || queries[0];
  const rows = useMemo(() => runReviewQuery(query, model, index), [query, model, index]);
  const label = row => { const table = model.tables.find(t => t.id === row.tableId);
    if (row.type === 'relationship') return model.relationships.find(r => r.id === row.relationshipId)?.name || String(row.relationshipId);
    return row.type === 'field' ? `${table?.name}.${table?.fields.find(f => f.id === row.fieldId)?.name}` : table?.name;
  };
  return <div className="review-queries"><div className="review-query-tools"><select aria-label={tr('审查查询')} value={query.id} onChange={e => onSelect(e.target.value)}>
    {queries.map(q => <option key={q.id} value={q.id}>{q.id.startsWith('builtin:') ? tr(q.name) : q.name}</option>)}
    </select><button disabled={readOnly} onClick={onNew}>{tr('新建查询')}</button>{!query.id.startsWith('builtin:') && <button disabled={readOnly} onClick={() => onEdit(query)}>{tr('编辑查询')}</button>}</div>
    <p>{tr('查询保存规则，结果始终引用当前模型。')}</p><p role="status">{rows.length} {tr('项结果')}</p>
    {!rows.length && <div className="reading-context-empty">{tr('当前查询没有匹配对象')}</div>}
    {rows.slice(0,500).map(row => <button className="review-query-result" key={JSON.stringify(row)} onClick={() => onLocate(row)} data-query-result={row.type}>
      <span>{label(row)}</span><small>{row.type === 'relationship' ? tr(row.valid ? row.status === 'candidate' ? '待确认关系' : '已确认关系' : '异常关联') : tr(row.type === 'field' ? '字段' : '表')}</small>
    </button>)}{rows.length > 500 && <p>{tr('仅显示前 500 项，请缩小查询范围')}</p>}
  </div>;
}
