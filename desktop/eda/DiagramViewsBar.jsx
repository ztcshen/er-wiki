import { useId } from 'react';
import { tr } from '../i18n/renderer';

export default function DiagramViewsBar({ views, active, onSelect, onCreate, onEdit, onCapture, onExport, onCandidates, candidateCount, showCandidates, onShowCandidates, busy, readOnly }) {
  const prefix = useId();
  const documents = [{ key: 'model', id: '', name: tr('完整模型') }, ...views.map(view => ({
    key: `view:${JSON.stringify([typeof view.id, view.id])}`, id: view.id, name: view.name,
  }))];
  const selected = active ? documents.find(document => document.id === active.id)?.key : 'model';
  const moveTab = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = documents.findIndex(document => document.key === selected);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? documents.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + documents.length) % documents.length;
    onSelect(documents[next].id);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <div className="diagram-views-bar" role="group" aria-label={tr('阅读视图')}>
    <div className="diagram-document-tabs" role="tablist" aria-label={tr('阅读视图')}>
      {documents.map(document => <button key={document.key} id={`${prefix}-${encodeURIComponent(document.key)}`}
        className="diagram-document-tab" role="tab" aria-selected={selected === document.key}
        tabIndex={selected === document.key ? 0 : -1} onKeyDown={moveTab} onClick={() => onSelect(document.id)} title={document.name}>
        <i className={`bi ${document.key === 'model' ? 'bi-diagram-3' : 'bi-file-earmark'}`} aria-hidden="true"/>
        <span>{document.name}</span>
      </button>)}
    </div>
    <select className="diagram-view-select" aria-label={tr('阅读视图')} value={selected}
      onChange={event => { const document = documents.find(item => item.key === event.target.value); if (document) onSelect(document.id); }}>
      {documents.map(document => <option key={document.key} value={document.key}>{document.name}</option>)}
    </select>
    <div className="diagram-view-actions">
      <button onClick={onCreate} disabled={readOnly} aria-label={tr('新建阅读视图')} title={tr('新建阅读视图')}><i className="bi bi-plus-lg" aria-hidden="true"/><span>{tr('新建视图')}</span></button>
      {active && <><button disabled={readOnly} onClick={onEdit}>{tr('编辑视图')}</button><button disabled={busy || readOnly} onClick={onCapture}>{tr('保存当前布局')}</button></>}
      {candidateCount > 0 && <label className="diagram-candidate-toggle"><input type="checkbox" checked={showCandidates} onChange={event => onShowCandidates(event.target.checked)}/>{tr('显示候选')}</label>}
      <button onClick={onCandidates} aria-label={tr('候选关联')}>{tr('候选')} <span>{candidateCount}</span></button>
      <button className="diagram-reading-export" disabled={busy} onClick={onExport} aria-label={tr('导出阅读器')}><i className="bi bi-file-earmark-richtext" aria-hidden="true"/> {tr('导出阅读器')}</button>
    </div>
  </div>;
}
