import { useEffect, useState } from 'react';
import { useParams } from '../../work/drawdb/node_modules/react-router-dom';
import { workspaceCommand } from './commands';
import { dateText, tr } from '../i18n/renderer';

export default function BackupPanel({onClose}) {
  const {id}=useParams(),[items,setItems]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const load=()=>window.erDesktop.listBackups(id||'blank').then(setItems).catch(e=>setError(e.message));
  useEffect(()=>{load();},[id]);
  const backup=async()=>{setBusy(true);setError('');const result=await workspaceCommand('backup');if(!result.ok)setError(result.error||'备份未完成');await load();setBusy(false);};
  const restore=async backupId=>{setBusy(true);const result=await workspaceCommand('restore',{backupId});setBusy(false);if(result.ok)onClose();else setError(result.error||'恢复已取消');};
  return <div className="desktop-form">
    <p>自动备份只记录已保存内容；手动备份包含当前编辑。恢复始终创建副本，原模型保持不变。</p>
    <p>备份保存在本机，不能代替异地备份。可导出 JSON 保存到你自己的备份位置。</p>
    <button disabled={busy} onClick={backup}>立即备份当前模型</button>
    {!items.length&&<p>当前模型尚无备份</p>}
    <div className="desktop-backup-list">{items.map(item=><article key={item.id}>
      <div><strong>{item.name}</strong><small>{dateText(item.createdAt)}</small></div>
      <button disabled={busy} onClick={()=>restore(item.id)}>恢复为副本</button>
    </article>)}</div>
    {error&&<p role="alert">{tr(error)}</p>}
  </div>;
}
