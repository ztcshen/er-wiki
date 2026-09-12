import { useEffect, useState } from 'react';
import { useSettings } from '@drawdb/hooks';
import { setLanguage, tr } from '../i18n/renderer';

export default function SettingsDialog() {
  const {settings,setSettings}=useSettings();
  const [preferences,setPreferences]=useState(null),[error,setError]=useState(''),[update,setUpdate]=useState(null),[busy,setBusy]=useState(false);
  useEffect(()=>{window.erDesktop.getPreferences().then(setPreferences).catch(e=>setError(e.message));},[]);
  const change=async value=>{setBusy(true);setError('');try{const next=value.language?await setLanguage(value.language):await window.erDesktop.setPreferences(value);setPreferences(p=>({...p,...next}));}catch(e){setError(e.message);}finally{setBusy(false);}};
  const check=async()=>{setBusy(true);setError('');try{setUpdate(await window.erDesktop.checkUpdates());}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <div className="desktop-form">
    <label>界面语言<select aria-label="界面语言" value={preferences?.language||'system'} disabled={!preferences||busy} onChange={e=>change({language:e.target.value})}>
      <option value="system">跟随系统</option><option value="zh">简体中文</option><option value="en">English</option>
    </select></label><small>只改变界面，不翻译或改写模型中的字段名、注释和枚举。</small>
    <label>外观<select value={settings.mode} onChange={e=>setSettings(s=>({...s,mode:e.target.value}))}><option value="light">浅色</option><option value="dark">深色</option></select></label>
    <label className="desktop-check"><input type="checkbox" checked={settings.autosave} onChange={e=>setSettings(s=>({...s,autosave:e.target.checked}))}/>自动保存模型</label>
    <label className="desktop-check"><input type="checkbox" checked={preferences?.autoBackup!==false} disabled={!preferences||busy} onChange={e=>change({autoBackup:e.target.checked})}/>自动备份已保存的模型</label>
    <label>每个模型保留备份<select value={preferences?.backupCount||20} disabled={!preferences||busy} onChange={e=>change({backupCount:Number(e.target.value)})}>{[10,20,50].map(n=><option value={n} key={n}>{n}</option>)}</select></label>
    <small>新备份成功后清理超出保留数量的旧备份；所有模型合计最多保留 200 份。</small>
    <button onClick={()=>window.erDesktop.openResource('data').catch(e=>setError(e.message))}>打开桌面数据目录</button>
    <hr/><strong>ER Wiki · {preferences?.version}</strong>
    <p>本地优先 · AGPL-3.0 · 基于 drawDB / Electron / ELK</p>
    <small>仅在你点击检查时访问 GitHub，不上传模型。当前不自动下载安装更新。</small>
    <div className="desktop-inline-actions"><button onClick={check} disabled={busy}>检查更新</button><button onClick={()=>window.erDesktop.openResource('releases').catch(e=>setError(e.message))}>下载与发布说明</button><button onClick={()=>window.erDesktop.openResource('feedback').catch(e=>setError(e.message))}>反馈问题</button></div>
    {update&&<p role="status">{update.available?'发现新版本':'当前版本不低于已发布版本'} · {update.latest}</p>}
    {error&&<p role="alert">{tr(error)}</p>}
  </div>;
}
