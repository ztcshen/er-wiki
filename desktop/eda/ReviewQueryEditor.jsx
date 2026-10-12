import { useState } from 'react';
import CanvasEditorDialog from '@drawdb/components/EditorCanvas/CanvasEditorDialog';
import { cleanReviewQuery, validateReviewQueries } from './review-queries.mjs';
import { tr } from '../i18n/renderer';

export default function ReviewQueryEditor({ query, groups, onSave, onDelete, onClose, readOnly }) {
  const [draft, setDraft] = useState(() => cleanReviewQuery(query || { id: crypto.randomUUID(), name: '', target: 'fields' }));
  const [error, setError] = useState('');
  const filter = (key, value) => setDraft(q => ({ ...q, filters: { ...q.filters, [key]: value } }));
  const options = (label, key, values) => <label>{tr(label)}<select aria-label={tr(label)} value={draft.filters[key]} disabled={readOnly} onChange={e => filter(key, e.target.value)}>
    {values.map(([value, text]) => <option key={value} value={value}>{tr(text)}</option>)}
  </select></label>;
  const save = () => { if (readOnly) return; try { validateReviewQueries([draft]); onSave(cleanReviewQuery(draft)); } catch (e) { setError(tr(e.message)); } };
  return <CanvasEditorDialog visible title={tr(query ? '编辑审查查询' : '新建审查查询')} onClose={onClose} footerNote=""><div className="desktop-form review-query-editor">
    <label>{tr('查询名称')}<input aria-label={tr('查询名称')} maxLength={120} value={draft.name} disabled={readOnly} onChange={e => setDraft(q => ({ ...q, name: e.target.value }))}/></label>
    <label>{tr('查询对象')}<select aria-label={tr('查询对象')} value={draft.target} disabled={readOnly} onChange={e => setDraft(q => ({ ...q, target: e.target.value }))}><option value="tables">{tr('表')}</option><option value="fields">{tr('字段')}</option><option value="relationships">{tr('关系')}</option></select></label>
    <label>{tr('所属分组')}<select aria-label={tr('所属分组')} value={draft.filters.groupId == null ? '' : JSON.stringify(draft.filters.groupId)} disabled={readOnly} onChange={e => filter('groupId',e.target.value ? JSON.parse(e.target.value) : null)}><option value="">{tr('全部分组')}</option>{groups.map(g => <option key={g.id} value={JSON.stringify(g.id)}>{g.name}</option>)}</select></label>
    {draft.target === 'relationships' && <>{options('确认状态','status',[['any','全部状态'],['candidate','待确认关系'],['confirmed','已确认关系'],['unresolved','异常关联']])}{options('关系性质','nature',[['any','全部性质'],['physical','物理外键'],['logical','逻辑关联'],['inferred','推断关联'],['unspecified','性质未声明']])}</>}
    {options('说明完整性','documentation',[['any','不限说明'],['missing','缺少说明'],['present','已有说明']])}
    <label>{tr('包含文字')}<input aria-label={tr('包含文字')} maxLength={300} disabled={readOnly} value={draft.filters.text} onChange={e => filter('text',e.target.value)}/></label>
    {error && <p role="alert">{error}</p>}<div className="diagram-view-member-actions"><button disabled={readOnly} onClick={save}>{tr('保存审查查询')}</button>{query && <button className="danger" disabled={readOnly} onClick={() => onDelete(query.id)}>{tr('删除查询')}</button>}</div>
  </div></CanvasEditorDialog>;
}
