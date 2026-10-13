import { useState } from 'react';
import { Popover } from '@douyinfe/semi-ui';
import { tr } from '../i18n/renderer';

export default function ReadingWorkbenchBar({ reading, workspaces, ready, onSave, onLoad, onRemove, onContext, onDirection, status, error }) {
  const [name, setName] = useState(''), [selected, setSelected] = useState('');
  const selectedWorkspace = workspaces.some(workspace => workspace.id === selected) ? selected : '';
  const content = <div className="reading-workspace-panel" role="group" aria-label={tr('阅读工作区')}>
    <strong>{tr('阅读工作区')}</strong>
    <label>{tr('已保存的工作区')}
      <select aria-label={tr('阅读工作区')} value={selectedWorkspace} disabled={!ready}
        onChange={event => { if (!event.target.value || onLoad(event.target.value) !== false) setSelected(event.target.value); }}>
        <option value="">{tr('当前阅读')}</option>{workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
      </select>
    </label>
    <form onSubmit={event => {
      event.preventDefault();
      if (!ready || !name.trim()) return;
      const saved = onSave(name); if (saved) { setSelected(saved.id); setName(''); }
    }}>
      <input aria-label={tr('工作区名称')} placeholder={tr('保存当前阅读')} maxLength={120} value={name} onChange={event => setName(event.target.value)}/>
      <button disabled={!ready || !name.trim()}>{tr('保存工作区')}</button>
    </form>
    {selectedWorkspace && <button disabled={!ready} onClick={() => { onRemove(selectedWorkspace); setSelected(''); }}>{tr('删除工作区')}</button>}
    <div className="reading-workspace-section" role="group" aria-label={tr('分屏方向')}>
      <span>{tr('分屏方向')}</span>
      <button aria-pressed={reading.layout.direction === 'horizontal'} onClick={() => onDirection('horizontal')}><i className="bi bi-layout-split" aria-hidden="true"/>{tr('左右分屏')}</button>
      <button aria-pressed={reading.layout.direction === 'vertical'} onClick={() => onDirection('vertical')}><i className="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"/>{tr('上下分屏')}</button>
    </div>
    <div className="reading-workspace-section">
      <button onClick={() => onContext('references')}>{tr('对象引用')}</button><button onClick={() => onContext('queries')}>{tr('审查查询')}</button>
    </div>
    {status && <span className="reading-index-status" role="status">{tr(status)}</span>}
    {error && <span role="alert">{tr(error)}</span>}
  </div>;
  return <Popover trigger="click" position="bottomRight" content={content}>
    <button className="reading-workspace-trigger" aria-label={tr('阅读工作区')} title={tr('保存或恢复阅读工作区')}>
      <i className="bi bi-window-stack" aria-hidden="true"/>{tr('工作区')}
    </button>
  </Popover>;
}
