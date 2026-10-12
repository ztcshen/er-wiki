import { useState } from 'react';
import { useDiagram, useLayout, useUndoRedo } from '@drawdb/hooks';
import { Action, ObjectType } from '@drawdb/data/constants';
import { isCandidateRelation } from '../review/relation-semantics.mjs';
import { relationshipDraft, validateRelationshipDraft } from '../review/relationship-draft.mjs';
import { tr } from '../i18n/renderer';

export default function CandidateRelationships({ model, onClose, onLocate }) {
  const { updateRelationship, deleteRelationship } = useDiagram(), { layout } = useLayout();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const [error, setError] = useState('');
  const candidates = model.relationships.filter(isCandidateRelation);
  const confirm = relation => {
    if (layout.readOnly) return;
    const reviewEvidence = { ...relation.reviewEvidence, status: 'confirmed', kind: 'logical' };
    const validation = validateRelationshipDraft({ ...relationshipDraft(relation), reviewEvidence }, model.tables, model.relationships, relation.id);
    if (validation.errors.length) { setError(tr(validation.errors[0])); return; }
    setUndoStack(s => [...s, { action: Action.EDIT, element: ObjectType.RELATIONSHIP, component: 'self', rid: relation.id,
      undo: { reviewEvidence: relation.reviewEvidence }, redo: { reviewEvidence }, message: tr('确认候选关联') }]);
    setRedoStack([]); updateRelationship(relation.id, { reviewEvidence }); setError('');
  };
  const table = id => model.tables.find(t => t.id === id)?.name || String(id);
  return <aside className="eda-inspector eda-candidates" aria-label={tr('候选关联')}>
    <header><h3>{tr('候选关联')} · {candidates.length}</h3><button aria-label={tr('关闭候选关联')} onClick={onClose}>×</button></header>
    <p>{tr('候选单独保留；确认后作为逻辑关联进入正式图。')}</p>
    {!candidates.length && <p>{tr('暂无待确认候选；可在关系编辑中设置确认状态。')}</p>}
    {candidates.map(r => <article key={r.id} data-candidate-id={r.id}><strong>{r.name || String(r.id)}</strong><p>{table(r.startTableId)} → {table(r.endTableId)}</p><p>{r.reviewEvidence?.description || tr('尚未填写关联依据')}</p><div className="diagram-view-member-actions"><button onClick={() => onLocate(r)}>{tr('定位候选')}</button><button disabled={layout.readOnly} onClick={() => confirm(r)}>{tr('确认为逻辑关联')}</button><button disabled={layout.readOnly} onClick={() => deleteRelationship(r.id)}>{tr('移除候选')}</button></div></article>)}
    {error && <p role="alert">{error}</p>}
  </aside>;
}
