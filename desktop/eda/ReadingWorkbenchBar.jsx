import { useState } from 'react';
import { tr } from '../i18n/renderer';

export default function ReadingWorkbenchBar({ reading, workspaces, ready, onSave, onLoad, onRemove, onContext, onDirection, status, error }) {
  const [name, setName] = useState(''), [selected, setSelected] = useState('');
  return <div className="reading-workbench-bar" role="group" aria-label={tr('阅读工作区')}>
    <select aria-label={tr('阅读工作区')} value={selected} onChange={e => { if (!e.target.value || onLoad(e.target.value) !== false) setSelected(e.target.value); }}>
      <option value="">{tr('当前阅读')}</option>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
    </select>
    <input aria-label={tr('工作区名称')} placeholder={tr('保存当前阅读')} maxLength={120} value={name} onChange={e => setName(e.target.value)}/>
    <button disabled={!ready || !name.trim()} onClick={() => { const saved = onSave(name); if (saved) { setSelected(saved.id); setName(''); } }}>{tr('保存工作区')}</button>
    {selected && <button onClick={() => { onRemove(selected); setSelected(''); }}>{tr('删除工作区')}</button>}
    <span className="reading-workbench-spacer"/>
    <button onClick={() => onDirection(reading.layout.direction === 'horizontal' ? 'vertical' : 'horizontal')}>{tr(reading.layout.direction === 'horizontal' ? '上下分屏' : '左右分屏')}</button>
    <button onClick={() => onContext('references')}>{tr('对象引用')}</button><button onClick={() => onContext('queries')}>{tr('审查查询')}</button>
    <span className="reading-index-status" role="status">{status ? tr(status) : ''}</span>{error && <span role="alert">{tr(error)}</span>}
  </div>;
}
