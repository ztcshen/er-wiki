import { useEffect, useState } from 'react';
import { useDiagram, useLayout, useUndoRedo } from '@drawdb/hooks';
import { Action, ObjectType } from '@drawdb/data/constants';
import { relationshipDraft, validateRelationshipDraft } from './relationship-draft.mjs';
import { tr } from '../i18n/renderer';

function draftOf(data) {
  const evidence = data.reviewEvidence;
  return { kind: typeof evidence?.kind === 'string' ? evidence.kind : evidence?.kind === undefined ? 'unspecified' : '__invalid__',
    enabled: !!evidence && Object.hasOwn(evidence, 'condition'),
    field: typeof evidence?.condition?.field === 'string' ? evidence.condition.field : '',
    value: typeof evidence?.condition?.value === 'string' || Number.isSafeInteger(evidence?.condition?.value) ? String(evidence.condition.value) : '' };
}

export default function RelationshipSemantics({ data }) {
  const { tables, relationships, updateRelationship } = useDiagram(), { layout } = useLayout();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const [draft, setDraft] = useState(() => draftOf(data)), [attempted, setAttempted] = useState(false);
  const original = JSON.stringify(data.reviewEvidence);
  useEffect(() => { setDraft(draftOf(data)); setAttempted(false); }, [data.id, original]);
  const prior = data.reviewEvidence && typeof data.reviewEvidence === 'object' && !Array.isArray(data.reviewEvidence) ? data.reviewEvidence : {};
  const evidence = { ...prior, kind: draft.kind };
  if (draft.enabled) evidence.condition = { field: draft.field, value: draft.value };
  else delete evidence.condition;
  const validation = validateRelationshipDraft({ ...relationshipDraft(data), reviewEvidence: evidence }, tables, relationships, data.id);
  const update = patch => setDraft(value => ({ ...value, ...patch }));
  const apply = () => {
    setAttempted(true);
    if (layout.readOnly || validation.errors.length) return;
    const redo = { reviewEvidence: evidence }, undo = { reviewEvidence: data.reviewEvidence };
    setUndoStack(stack => [...stack, { action: Action.EDIT, element: ObjectType.RELATIONSHIP, component: 'self', rid: data.id, undo, redo, message: tr('修改关系定义') }]);
    setRedoStack([]); updateRelationship(data.id, redo);
  };
  return <section className="relationship-endpoint-editor">
    <label>{tr('关系性质')} <select aria-label={tr('关系性质')} value={draft.kind} disabled={layout.readOnly} onChange={e => update({ kind: e.target.value })}>
      {!['unspecified', 'physical', 'logical', 'inferred'].includes(draft.kind) && <option value={draft.kind}>{tr('关系定义无效')}</option>}
      <option value="unspecified">{tr('性质未声明')}</option><option value="physical">{tr('已声明物理外键')}</option>
      <option value="logical">{tr('逻辑关联')}</option><option value="inferred">{tr('推断关联')}</option>
    </select></label>
    <p>{tr('物理声明不等于已经验证数据库；交换端点会改变关系含义。')}</p>
    <label><input type="checkbox" checked={draft.enabled} disabled={layout.readOnly} onChange={e => update({ enabled: e.target.checked })} />{tr('条件关联')}</label>
    {draft.enabled && <div className="relationship-fields">
      <label>{tr('源表条件字段')}<input aria-label={tr('源表条件字段')} value={draft.field} disabled={layout.readOnly} onChange={e => update({ field: e.target.value })} /></label>
      <label>{tr('条件值')}<input aria-label={tr('条件值')} value={draft.value} disabled={layout.readOnly} onChange={e => update({ value: e.target.value })} /></label>
    </div>}
    {attempted && validation.errors.map(message => <p role="alert" key={message}>{tr(message)}</p>)}
    {validation.warnings.map(message => <p key={message}>{tr(message)}</p>)}
    <button type="button" disabled={layout.readOnly || JSON.stringify(evidence) === original} onClick={apply}>{tr('应用关系定义')}</button>
  </section>;
}
