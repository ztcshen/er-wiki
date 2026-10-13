import { tr } from '../i18n/renderer';

const panels = [['details', '属性', 'sliders2'], ['references', '引用', 'link-45deg'], ['queries', '查询', 'filter'], ['display', '显示', 'layers']];

export default function WorkbenchStatus({ status, busy, error, selection, count, context, showDirectory, onDirectory, onPanel,
  hasSelection, onClear, scale, onZoom, onFit, onActualSize }) {
  return <footer className="engineering-statusbar" aria-label={tr('工作台状态')}>
    <button aria-label={tr('项目面板')} aria-pressed={showDirectory} onClick={onDirectory} title={tr('项目面板')}><i className="bi bi-layout-sidebar" aria-hidden="true"/><span>{tr('项目')}</span></button>
    <span className="engineering-status" data-state={error ? 'error' : busy ? 'busy' : 'ready'} role="status"><i aria-hidden="true"/>{tr(status)}</span>
    <span className="engineering-selection" title={selection}>{selection || tr('未选择对象')}</span>
    {hasSelection && <button className="engineering-clear" onClick={onClear} title={tr('清除聚焦')}><i className="bi bi-x-circle" aria-hidden="true"/>{tr('清除聚焦')}</button>}
    <span className="engineering-count">{count}</span>
    <div className="engineering-zoom" aria-label={tr('图形导航')}>
      <button aria-label={tr('缩小')} onClick={() => onZoom(1.2)}>−</button>
      <button aria-label={tr('原始大小（100%）')} onClick={onActualSize}>{Math.round(scale * 100)}%</button>
      <button aria-label={tr('放大')} onClick={() => onZoom(1 / 1.2)}>+</button>
      <button aria-label={tr('适应窗口')} onClick={onFit}><i className="bi bi-arrows-fullscreen" aria-hidden="true"/></button>
    </div>
    <div className="engineering-panel-controls" aria-label={tr('面板')}>
      {panels.map(([id, label, icon]) => <button key={id} data-panel-toggle={id} aria-pressed={context.visible && context.active === id}
        onClick={() => onPanel(id)} title={tr(label)}><i className={`bi bi-${icon}`} aria-hidden="true"/><span>{tr(label)}</span></button>)}
    </div>
  </footer>;
}
