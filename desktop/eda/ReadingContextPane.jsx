import { tr } from '../i18n/renderer';
const titles = { details: '对象详情', references: '对象引用', queries: '审查查询' };
export default function ReadingContextPane({ active, onSelect, onClose, children }) {
  return <aside className="reading-context-pane" aria-label={tr('阅读上下文')}>
    <div className="reading-context-tabs" role="tablist" aria-label={tr('上下文视图')}>
      {Object.entries(titles).map(([id, title]) => <button key={id} role="tab" aria-selected={active === id} onClick={() => onSelect(id)}>{tr(title)}</button>)}
      <button className="reading-context-close" onClick={onClose} aria-label={tr('关闭阅读上下文')}>×</button>
    </div><div className="reading-context-content" role="tabpanel">{children}</div>
  </aside>;
}
