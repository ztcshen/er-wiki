import { useEffect, useState } from 'react';
import CanvasEditorDialog from '@drawdb/components/EditorCanvas/CanvasEditorDialog';
import SettingsDialog from './SettingsDialog';
import BackupPanel from './BackupPanel';
import SqlImport from './SqlImport';

export default function DesktopPanels() {
  const [panel,setPanel]=useState('');
  useEffect(()=>{const show=({detail})=>setPanel(detail);window.addEventListener('erwiki-open-panel',show);return()=>window.removeEventListener('erwiki-open-panel',show);},[]);
  const title=panel==='settings'?'设置':panel==='backups'?'备份与恢复':panel==='sql'?'导入 SQL':'使用说明';
  return <CanvasEditorDialog title={title} visible={!!panel} footerNote="" onClose={()=>setPanel('')}>
    {panel==='settings'?<SettingsDialog/>:panel==='backups'?<BackupPanel onClose={()=>setPanel('')}/>:panel==='sql'?<SqlImport onClose={()=>setPanel('')}/>:<div className="desktop-form">
      <h3>从一个模型开始</h3><p>可以直接阅读内置的虚构电商履约示例，也可以从“更多”导入 JSON 或 SQL。导入始终创建新模型。</p>
      <h3>阅读复杂关系</h3><p>总图包含全部表。点击领域深入查看，搜索可以定位表、字段、别名或枚举。双击表编辑；拖动空白平移，滚轮缩放。</p>
      <p>Bus 合并共享引用，Net Label 表示同名逻辑连接。点击连线或标签查看完整关系；虚线表示待核关系。</p>
      <h3>保存与恢复</h3><p>模型内容保存在本机工作区。视角和书签单独记忆，不改变模型保存时间。导出文件是独立快照；备份恢复为副本。</p>
      <h3>快捷操作</h3><p>保存：⌘ / Ctrl + S；撤销：⌘ / Ctrl + Z；重做：⌘ / Ctrl + Shift + Z；设置：⌘ / Ctrl + ,。</p>
      <p>数据库字段名、注释和枚举都是模型内容，界面切换语言不会翻译它们。</p>
    </div>}
  </CanvasEditorDialog>;
}
