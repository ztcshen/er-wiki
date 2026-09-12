import { useLayout, useSettings } from '../../work/drawdb/src/hooks';
import { Dropdown, Popconfirm } from '@douyinfe/semi-ui';
import { State } from '../../work/drawdb/src/data/constants';
import DesktopModelSwitcher from './DesktopModelSwitcher';
import DesktopPanels from './DesktopPanels';
import { openPanel } from './commands';
import { dateText } from '../i18n/renderer';
import { useEffect, useState } from 'react';

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
  if(menu.edit.copy_as_image)menu.edit.copy_as_image.function=()=>edaCommand('copy-image');
  if(menu.settings.language)menu.settings.language.function=()=>openPanel('settings');
}

function MenuEntry({ entry, label, translate, onAction }) {
  if(entry.divider)return <Dropdown.Divider/>;
  if(entry.children)return <Dropdown position="rightTop" render={<Dropdown.Menu className="desktop-more-menu">
    {entry.children.map((child,index)=><MenuEntry key={index} entry={child} label={child.name} translate={translate} onAction={onAction}/>)}
  </Dropdown.Menu>}>
    <Dropdown.Item disabled={entry.disabled} onClick={entry.function}><span className="desktop-menu-label">{label}</span><i className="bi bi-chevron-right" aria-hidden="true"/></Dropdown.Item>
  </Dropdown>;
  const content=<><span className="desktop-menu-label">{label}</span>{entry.state}<small>{entry.shortcut}</small></>;
  if(entry.warning&&!entry.disabled)return <Popconfirm title={entry.warning.title} content={entry.warning.message}
    onConfirm={entry.function} okText={translate('confirm')} cancelText={translate('cancel')} position="right">
    <Dropdown.Item>{content}</Dropdown.Item>
  </Popconfirm>;
  return <Dropdown.Item disabled={entry.disabled} onClick={()=>{entry.function?.();onAction?.();}}>{content}</Dropdown.Item>;
}

export default function DesktopHeader({ undo, redo, save, canUndo, canRedo, menu, translate, onRename, title, lastSaved, saveState }) {
  const [moreOpen,setMoreOpen]=useState(false),[addOpen,setAddOpen]=useState(false);
  useEffect(()=>{
    const close=()=>{setMoreOpen(false);setAddOpen(false);};
    const names=['erwiki-open-panel','erwiki-eda-command','erwiki-command'];
    names.forEach(name=>window.addEventListener(name,close));return()=>names.forEach(name=>window.removeEventListener(name,close));
  },[]);
  const { layout } = useLayout(), { settings, setSettings } = useSettings();
  const status=layout.readOnly?'只读':saveState===State.SAVING?'保存中…':saveState===State.ERROR?'保存失败':settings.autosave?'自动保存':'手动保存';
  const shortcut=window.navigator.platform.includes('Mac')?'⌘':'Ctrl+';
  const command=action=>window.dispatchEvent(new CustomEvent('erwiki-command',{detail:action}));
  return <><header className="desktop-header" aria-label="模型操作">
    <div className="desktop-header-identity"><span className="desktop-brand" title="ER Wiki · 本机工作区"><i className="bi bi-diagram-3" aria-hidden="true"/></span><DesktopModelSwitcher/></div>
    <div className="desktop-header-actions">
      <span className={`desktop-save-status ${saveState===State.ERROR?'is-error':''}`} title={`${status}；${lastSaved?`上次模型保存：${dateText(lastSaved)}`:'尚无保存记录'}。图形阅读不改变保存时间。`}><i aria-hidden="true"/>{status}</span>
      <div className="desktop-history"><button className="desktop-icon-button" onClick={undo} disabled={!canUndo||layout.readOnly} aria-label="撤销" title={`撤销 · ${shortcut}Z`}><i className="bi bi-arrow-counterclockwise" aria-hidden="true"/></button>
        <button className="desktop-icon-button" onClick={redo} disabled={!canRedo||layout.readOnly} aria-label="重做" title={`重做 · ${shortcut}Shift+Z`}><i className="bi bi-arrow-clockwise" aria-hidden="true"/></button></div>
      <Dropdown trigger="click" visible={addOpen} onVisibleChange={setAddOpen} position="bottomRight" render={<Dropdown.Menu>
        <Dropdown.Item disabled={layout.readOnly} onClick={()=>edaCommand('add-table')}>新增表</Dropdown.Item>
        <Dropdown.Item disabled={layout.readOnly} onClick={()=>edaCommand('add-relationship')}>新增关系</Dropdown.Item>
      </Dropdown.Menu>}><button className="desktop-add-button" disabled={layout.readOnly}><i className="bi bi-plus-lg" aria-hidden="true"/>新增</button></Dropdown>
      <button className="desktop-save-button" onClick={save} disabled={layout.readOnly||saveState===State.SAVING} aria-label="保存模型" title={`保存模型 · ${shortcut}S`}>保存</button>
      <Dropdown trigger="click" visible={moreOpen} onVisibleChange={setMoreOpen} position="bottomRight" render={<Dropdown.Menu className="desktop-more-menu">
        <Dropdown.Item onClick={()=>command('new')}>新建空白模型</Dropdown.Item>
        <Dropdown.Item onClick={()=>command('clone')}>复制当前模型</Dropdown.Item>
        <Dropdown.Item onClick={()=>command('import')}>导入 JSON…</Dropdown.Item>
        <Dropdown.Item onClick={()=>openPanel('sql')}>导入 SQL…</Dropdown.Item>
        <Dropdown.Item onClick={()=>command('export')}>导出 JSON…</Dropdown.Item>
        <Dropdown.Item onClick={()=>command('export-sql')}>导出 SQL…</Dropdown.Item>
        <Dropdown.Item onClick={()=>edaCommand('export-diagram')}>导出 ER 图…</Dropdown.Item>
        <Dropdown.Item onClick={()=>edaCommand('model')}>模型编辑…</Dropdown.Item>
        <Dropdown.Item disabled={layout.readOnly} onClick={()=>{setMoreOpen(false);onRename();}}>重命名模型…</Dropdown.Item>
        <Dropdown.Divider/>
        <Dropdown.Item onClick={()=>openPanel('backups')}>备份与恢复…</Dropdown.Item>
        <Dropdown.Item onClick={()=>openPanel('settings')}>设置…</Dropdown.Item>
        <Dropdown.Item onClick={()=>openPanel('help')}>使用说明</Dropdown.Item>
        <Dropdown.Divider/>
        {Object.entries(menu).filter(([category])=>category!=='file').map(([category,items])=><MenuEntry key={category} translate={translate} label={translate(category)} onAction={()=>setMoreOpen(false)}
          entry={{children:Object.entries(items).filter(([key])=>!['language','theme','autosave'].includes(key)).map(([key,entry])=>({...entry,name:translate(key)}))}}/>)}
      </Dropdown.Menu>}><button className="desktop-icon-button" aria-label="更多操作" title={`${title} · 更多操作`}><i className="bi bi-three-dots" aria-hidden="true"/></button></Dropdown>
    </div>
  </header><DesktopPanels/></>;
}
