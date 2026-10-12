import { useState } from 'react';
import CanvasEditorDialog from '@drawdb/components/EditorCanvas/CanvasEditorDialog';
import { tr } from '../i18n/renderer';

export default function DiagramViewEditor({ view, model, onSave, onDelete, onClose, readOnly }) {
  const [name, setName] = useState(view?.name || ''), [description, setDescription] = useState(view?.description || '');
  const [members, setMembers] = useState(() => view?.depicts.map(d => d.tableId) || model.tables.map(t => t.id));
  const [depicts, setDepicts] = useState(() => view?.depicts || []);
  const [error, setError] = useState('');
  const patchDepict = (tableId, patch) => setDepicts(values => values.some(d => d.tableId === tableId)
    ? values.map(d => d.tableId === tableId ? { ...d, ...patch } : d) : [...values, { tableId, ...patch }]);
  const member = table => {
    const depict = depicts.find(d => d.tableId === table.id) || { tableId: table.id };
    return <div className="diagram-view-member" key={table.id}><label><input type="checkbox" aria-label={`${tr('包含表')} ${table.name}`} checked={members.includes(table.id)} disabled={readOnly} onChange={e => setMembers(xs => e.target.checked ? [...xs, table.id] : xs.filter(id => id !== table.id))}/><span>{table.name}<small>{table.reviewChineseName || table.comment}</small></span></label>
      {members.includes(table.id) && <details><summary>{tr('当前视图显示设置')}</summary><label>{tr('表颜色')}<input type="color" aria-label={`${tr('表颜色')} ${table.name}`} disabled={readOnly} value={depict.color || model.groups.find(g => g.tableIds.includes(table.id))?.color || table.color || '#64748b'} onChange={e => patchDepict(table.id, { color: e.target.value })}/></label>
      <label><input type="checkbox" disabled={readOnly} checked={Array.isArray(depict.hiddenFieldIds)} onChange={e => patchDepict(table.id, { hiddenFieldIds: e.target.checked ? [] : undefined })}/>{tr('自定义显示字段')}</label>
      {Array.isArray(depict.hiddenFieldIds) && table.fields.map(field => <label key={field.id}><input type="checkbox" aria-label={`${tr('显示字段')} ${table.name}.${field.name}`} disabled={readOnly} checked={!depict.hiddenFieldIds.includes(field.id)} onChange={e => patchDepict(table.id, { hiddenFieldIds: e.target.checked ? depict.hiddenFieldIds.filter(id => id !== field.id) : [...depict.hiddenFieldIds, field.id] })}/>{field.name}</label>)}</details>}
    </div>;
  };
  const save = () => {
    if (!name.trim() || !members.length) { setError(tr('请输入视图名称并选择至少一张表')); return; }
    onSave({ ...view, id: view?.id || crypto.randomUUID(), name: name.trim(), description: description.trim(),
      depicts: model.tables.filter(t => members.includes(t.id)).map(t => depicts.find(d => d.tableId === t.id) || { tableId: t.id }) });
  };
  return <CanvasEditorDialog visible title={tr(view ? '编辑阅读视图' : '新建阅读视图')} onClose={onClose} footerNote="">
    <div className="desktop-form diagram-view-editor">
      <label>{tr('视图名称')}<input aria-label={tr('视图名称')} maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={readOnly} /></label>
      <label>{tr('视图说明')}<textarea aria-label={tr('视图说明')} maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} disabled={readOnly} /></label>
      <p>{tr('不同视图共享同一份表结构，各自保留成员、位置和显示设置。')}</p>
      <div className="diagram-view-member-actions"><button disabled={readOnly} onClick={() => setMembers(model.tables.map(t => t.id))}>{tr('选择全部表')}</button><button disabled={readOnly} onClick={() => setMembers([])}>{tr('清空选择')}</button><span>{members.length} / {model.tables.length}</span></div>
      <div className="diagram-view-members">{model.groups.map(group => <fieldset key={group.id}><legend>{group.name}</legend>{model.tables.filter(t => group.tableIds.includes(t.id)).map(member)}</fieldset>)}
      {model.tables.filter(t => !model.groups.some(g => g.tableIds.includes(t.id))).map(member)}</div>
      {error && <p role="alert">{error}</p>}
      <div className="diagram-view-member-actions"><button onClick={save} disabled={readOnly}>{tr('保存阅读视图')}</button>{view && <button className="danger" disabled={readOnly} onClick={() => onDelete(view.id)}>{tr('删除此视图')}</button>}</div>
    </div>
  </CanvasEditorDialog>;
}
