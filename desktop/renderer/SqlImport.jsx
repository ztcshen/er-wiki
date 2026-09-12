import { useEffect, useRef, useState } from 'react';
import { workspaceCommand } from './commands';
import { tr } from '../i18n/renderer';

export default function SqlImport({onClose}) {
  const [sql,setSql]=useState(''),[database,setDatabase]=useState('mysql'),[name,setName]=useState('');
  const [preview,setPreview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const job=useRef(null);
  useEffect(()=>()=>{clearTimeout(job.current?.timer);job.current?.worker.terminate();},[]);
  const chooseFile=async()=>{try{const file=await window.erDesktop.openModel('sql');if(file){setSql(file.json);setName(file.name.replace(/\.sql$/i,''));setPreview(null);}}catch(e){setError(e.message);}};
  const parse=()=>{
    setError('');setPreview(null);if(new TextEncoder().encode(sql).length>20*1024*1024){setError('SQL 文件不能超过 20 MB');return;}
    setBusy(true);const worker=new Worker(new URL('./sql-import.worker.js',import.meta.url),{type:'module'});
    const finish=()=>{worker.terminate();clearTimeout(job.current?.timer);job.current=null;setBusy(false);};
    const timer=setTimeout(()=>{finish();setError('SQL 解析超时，请缩小文件后重试');},15000);job.current={worker,timer};
    worker.onmessage=({data})=>{finish();data.error?setError(data.error):setPreview(data);};worker.onerror=e=>{finish();setError(e.message);};
    worker.postMessage({sql,database,name});
  };
  const importPreview=async()=>{setBusy(true);const result=await workspaceCommand('import-json',{json:JSON.stringify(preview.document),name:name||'SQL model'});setBusy(false);if(result.ok)onClose();else setError(result.error||'导入已取消');};
  return <div className="desktop-form">
    <p>SQL 只在本机解析，不连接数据库、不执行语句。导入为新模型，不覆盖当前模型。</p>
    <label>模型名称<input value={name} maxLength={120} onChange={e=>{setName(e.target.value);setPreview(null);}}/></label>
    <label>SQL 方言<select value={database} onChange={e=>{setDatabase(e.target.value);setPreview(null);}}><option value="mysql">MySQL</option><option value="postgresql">PostgreSQL</option><option value="sqlite">SQLite</option><option value="transactsql">SQL Server</option><option value="mariadb">MariaDB</option></select></label>
    <textarea aria-label="SQL DDL" value={sql} spellCheck={false} placeholder="CREATE TABLE ..." onChange={e=>{setSql(e.target.value);setPreview(null);}} rows={9}/>
    <div className="desktop-inline-actions"><button onClick={chooseFile} disabled={busy}>选择 SQL 文件</button><button onClick={parse} disabled={busy||!sql.trim()}>{busy?'正在处理…':'解析预览'}</button></div>
    {preview&&<section><p>解析结果：{preview.document.tables.length} 张表，{preview.document.relationships.length} 条关系</p>
      {!!preview.ignored&&<p role="status">包含非建表语句，请核对解析结果；未执行任何 SQL。</p>}
      <div className="desktop-preview-list">{preview.document.tables.map(t=><span key={t.id}>{t.name} · {t.fields.length}</span>)}</div>
      <button disabled={busy} onClick={importPreview}>导入为新模型</button></section>}
    {error&&<p role="alert">{tr(error)}</p>}
  </div>;
}
