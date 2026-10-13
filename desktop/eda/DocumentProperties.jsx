import { tr } from '../i18n/renderer';
import { isCandidateRelation } from '../review/relation-semantics.mjs';

export default function DocumentProperties({ model, title, activeView, result, onDisplay, onCheck }) {
  const relationships = model.relationships || [];
  const candidateCount = relationships.filter(isCandidateRelation).length;
  const visibleTables = result?.projection.nodes.filter(node => node.kind === 'table').length;
  return <section className="document-properties" aria-label={tr('文档属性')}>
    <div className="document-properties-title"><i className="bi bi-file-earmark-richtext" aria-hidden="true"/><div><strong>{title || model.title || tr('未命名模型')}</strong><span>{tr('文档属性')}</span></div></div>
    <dl>
      <dt>{tr('当前视图')}</dt><dd>{activeView?.name || tr('完整模型')}</dd>
      <dt>{tr('模型表数')}</dt><dd>{model.tables?.length || 0}</dd>
      <dt>{tr('可见表')}</dt><dd>{visibleTables ?? '…'}</dd>
      <dt>{tr('关联')}</dt><dd>{relationships.length - candidateCount}</dd>
      <dt>{tr('候选关联')}</dt><dd>{candidateCount}</dd>
      <dt>{tr('领域')}</dt><dd>{model.groups?.length || 0}</dd>
    </dl>
    {activeView?.description && <p className="document-properties-description">{activeView.description}</p>}
    <p className="document-properties-hint">{tr('选择表、字段或关联以查看属性')}</p>
    <div className="document-properties-actions">
      <button onClick={onDisplay}><i className="bi bi-sliders" aria-hidden="true"/>{tr('显示设置')}</button>
      <button onClick={onCheck}><i className="bi bi-check2-square" aria-hidden="true"/>{tr('结构检查')}</button>
    </div>
  </section>;
}
