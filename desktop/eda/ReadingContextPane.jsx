import { useId } from 'react';
import { tr } from '../i18n/renderer';
const views = [
  { id: 'details', name: '属性', title: '对象详情' },
  { id: 'references', name: '引用', title: '对象引用' },
  { id: 'queries', name: '查询', title: '审查查询' },
  { id: 'display', name: '显示', title: '图形显示设置' },
];
export default function ReadingContextPane({ active, onSelect, onClose, children }) {
  const prefix = useId();
  const moveTab = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = views.findIndex(view => view.id === active);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length;
    onSelect(views[next].id);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <aside className="reading-context-pane" aria-label={tr('阅读上下文')}>
    <div className="reading-context-heading"><strong>{tr('属性与显示')}</strong><button className="reading-context-close" onClick={onClose} aria-label={tr('关闭阅读上下文')}>×</button></div>
    <div className="reading-context-tabs" role="tablist" aria-label={tr('上下文视图')}>
      {views.map(view => <button key={view.id} id={`${prefix}-${view.id}`} role="tab" aria-selected={active === view.id}
        aria-controls={`${prefix}-panel`} aria-label={tr(view.title)} title={tr(view.title)} tabIndex={active === view.id ? 0 : -1}
        onKeyDown={moveTab} onClick={() => onSelect(view.id)}>{tr(view.name)}</button>)}
    </div><div className="reading-context-content" id={`${prefix}-panel`} role="tabpanel" aria-labelledby={`${prefix}-${active}`}>{children}</div>
  </aside>;
}
