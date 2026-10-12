import { tr } from '../i18n/renderer';

export default function DiagramViewsBar({ views, active, onSelect, onCreate, onEdit, onCapture, onExport, onCandidates, candidateCount, showCandidates, onShowCandidates, busy, readOnly }) {
  return <div className="diagram-views-bar" role="group" aria-label={tr('阅读视图')}>
    <i className="bi bi-collection" aria-hidden="true"/>
    <select aria-label={tr('阅读视图')} value={active?.id || ''} onChange={e => onSelect(e.target.value)}><option value="">{tr('完整模型')}</option>{views.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
    <button onClick={onCreate} disabled={readOnly} aria-label={tr('新建阅读视图')}><i className="bi bi-plus-lg"/> {tr('新建视图')}</button>
    {active && <><button disabled={readOnly} onClick={onEdit}>{tr('编辑视图')}</button><button disabled={busy || readOnly} onClick={onCapture}>{tr('保存当前布局')}</button><span className="diagram-view-hint">{tr('拖动表头调整当前视图')}</span></>}
    <span className="diagram-view-spacer"/>
    {candidateCount > 0 && <label className="diagram-candidate-toggle"><input type="checkbox" checked={showCandidates} onChange={e => onShowCandidates(e.target.checked)}/>{tr('显示候选')}</label>}
    <button onClick={onCandidates} aria-label={tr('候选关联')}>{tr('候选')} <span>{candidateCount}</span></button>
    <button className="diagram-reading-export" disabled={busy} onClick={onExport} aria-label={tr('导出阅读器')}><i className="bi bi-file-earmark-richtext" aria-hidden="true"/> {tr('导出阅读器')}</button>
  </div>;
}
