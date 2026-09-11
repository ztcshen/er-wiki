import { useLayout, useSettings } from '../../work/drawdb/src/hooks';
import { Dropdown, Popconfirm } from '@douyinfe/semi-ui';
import { State } from '../../work/drawdb/src/data/constants';
import DesktopModelSwitcher from './DesktopModelSwitcher';

export const edaCommand = action => window.dispatchEvent(new CustomEvent('erwiki-eda-command', { detail: action }));

// Keep the mature model/file tools; remove commands for the retired canvas.
export function configureEdaMenu(menu) {
  const keep = {
    edit: ['undo', 'redo', 'auto_connect_fk', 'copy_as_image'],
    view: ['theme', 'fullscreen', 'reset_view', 'zoom_in', 'zoom_out', 'dbml_view'],
    settings: ['autosave', 'show_timeline', 'configure_custom_types', 'language'],
  };
  for (const [category, keys] of Object.entries(keep))
    for (const key of Object.keys(menu[category])) if (!keys.includes(key)) delete menu[category][key];
  for (const [key, action] of Object.entries({ reset_view: 'fit', zoom_in: 'zoom-in', zoom_out: 'zoom-out', dbml_view: 'code' }))
    if (menu.view[key]) menu.view[key].function = () => edaCommand(action);
}

function MenuEntry({ entry, label, translate }) {
  if(entry.divider)return <Dropdown.Divider/>;
  if(entry.children)return <Dropdown position="rightTop" render={<Dropdown.Menu className="desktop-more-menu">
    {entry.children.map((child,index)=><MenuEntry key={index} entry={child} label={child.name} translate={translate}/>)}
  </Dropdown.Menu>}>
    <Dropdown.Item disabled={entry.disabled} onClick={entry.function}><span className="desktop-menu-label">{label}</span><i className="bi bi-chevron-right" aria-hidden="true"/></Dropdown.Item>
  </Dropdown>;
  const content=<><span className="desktop-menu-label">{label}</span>{entry.state}<small>{entry.shortcut}</small></>;
  if(entry.warning&&!entry.disabled)return <Popconfirm title={entry.warning.title} content={entry.warning.message}
    onConfirm={entry.function} okText={translate('confirm')} cancelText={translate('cancel')} position="right">
    <Dropdown.Item>{content}</Dropdown.Item>
  </Popconfirm>;
  return <Dropdown.Item disabled={entry.disabled} onClick={entry.function}>{content}</Dropdown.Item>;
}

export default function DesktopHeader({ undo, redo, save, canUndo, canRedo, menu, translate, onRename, title, lastSaved, saveState }) {
  const { layout } = useLayout(), { settings, setSettings } = useSettings();
  const status=layout.readOnly?'只读':saveState===State.SAVING?'保存中…':saveState===State.ERROR?'保存失败':settings.autosave?'自动保存':'手动保存';
  return <header className="desktop-header" aria-label="模型操作">
    <div className="desktop-header-identity"><span className="desktop-brand" title="ER Wiki · 本机工作区"><i className="bi bi-diagram-3" aria-hidden="true"/></span><DesktopModelSwitcher/></div>
    <div className="desktop-header-actions">
      <span className={`desktop-save-status ${saveState===State.ERROR?'is-error':''}`} title={`${status}；${lastSaved?`上次模型保存：${lastSaved}`:'尚无保存记录'}。图形阅读不改变保存时间。`}><i aria-hidden="true"/>{status}</span>
      <div className="desktop-history"><button className="desktop-icon-button" onClick={undo} disabled={!canUndo||layout.readOnly} aria-label="撤销" title="撤销 · ⌘Z"><i className="bi bi-arrow-counterclockwise" aria-hidden="true"/></button>
        <button className="desktop-icon-button" onClick={redo} disabled={!canRedo||layout.readOnly} aria-label="重做" title="重做 · ⌘⇧Z"><i className="bi bi-arrow-clockwise" aria-hidden="true"/></button></div>
      <Dropdown trigger="click" position="bottomRight" render={<Dropdown.Menu>
        <Dropdown.Item disabled={layout.readOnly} onClick={()=>edaCommand('add-table')}>新增表</Dropdown.Item>
        <Dropdown.Item disabled={layout.readOnly} onClick={()=>edaCommand('add-relationship')}>新增关系</Dropdown.Item>
      </Dropdown.Menu>}><button className="desktop-add-button" disabled={layout.readOnly}><i className="bi bi-plus-lg" aria-hidden="true"/>新增</button></Dropdown>
      <button className="desktop-save-button" onClick={save} disabled={layout.readOnly||saveState===State.SAVING} aria-label="保存模型" title="保存模型 · ⌘S">保存</button>
      <Dropdown trigger="click" position="bottomRight" render={<Dropdown.Menu className="desktop-more-menu">
        <Dropdown.Item onClick={()=>window.dispatchEvent(new CustomEvent('erwiki-command',{detail:'import'}))}>导入模型…</Dropdown.Item>
        <Dropdown.Item onClick={()=>window.dispatchEvent(new CustomEvent('erwiki-command',{detail:'export'}))}>导出 JSON…</Dropdown.Item>
        <Dropdown.Item onClick={()=>edaCommand('model')}>模型编辑…</Dropdown.Item>
        <Dropdown.Item disabled={layout.readOnly} onClick={onRename}>重命名模型…</Dropdown.Item>
        <Dropdown.Divider/>
        <Dropdown.Item onClick={()=>setSettings(s=>({...s,autosave:!s.autosave}))}><span className="desktop-menu-label">自动保存模型</span>{settings.autosave&&<i className="bi bi-check2" aria-hidden="true"/>}</Dropdown.Item>
        <Dropdown.Item onClick={()=>setSettings(s=>({...s,mode:s.mode==='dark'?'light':'dark'}))}>切换为{settings.mode==='dark'?'浅色':'深色'}</Dropdown.Item>
        <Dropdown.Divider/>
        {Object.entries(menu).map(([category,items])=><MenuEntry key={category} translate={translate} label={category==='file'?'其他文件操作':translate(category)}
          entry={{children:Object.entries(items).map(([key,entry])=>({...entry,name:translate(key)}))}}/>)}
      </Dropdown.Menu>}><button className="desktop-icon-button" aria-label="更多操作" title={`${title} · 更多操作`}><i className="bi bi-three-dots" aria-hidden="true"/></button></Dropdown>
    </div>
  </header>;
}
