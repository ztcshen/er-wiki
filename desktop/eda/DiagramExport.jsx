import { useEffect, useRef, useState } from 'react';
import CanvasEditorDialog from '@drawdb/components/EditorCanvas/CanvasEditorDialog';
import { diagramSvg, svgToPng } from './export-diagram';
import { tr } from '../i18n/renderer';
import { createLayoutTask } from './layout-task.mjs';

export default function DiagramExport({model,result,current,location,view}) {
  const [open,setOpen]=useState(false),[scope,setScope]=useState('view'),[format,setFormat]=useState('svg');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const job=useRef(null);
  useEffect(()=>{
    const listener=({detail})=>{if(detail==='export-diagram'||detail==='copy-image'){setOpen(true);setScope('view');setFormat(detail==='copy-image'?'clipboard':'svg');setError('');setMessage('');}};
    window.addEventListener('erwiki-eda-command',listener);return()=>{window.removeEventListener('erwiki-eda-command',listener);job.current?.cancel();};
  },[]);
  const arrange=options=>{
    const task=createLayoutTask(()=>new Worker(new URL('./layout.worker.js',import.meta.url),{type:'module'}),model,options);
    job.current=task;return task.promise.finally(()=>{if(job.current===task)job.current=null;});
  };
  const run=async()=>{
    setBusy(true);setError('');setMessage('');
    try {
      let selected=result,viewport=view;
      if(scope==='view'&&!current)throw new Error('请等待当前布局完成');
      if(scope!=='view'){
        selected=await arrange({...location,level:scope==='domain'?'domain':'overview',domainId:scope==='domain'?location.domainId:'',tableId:null,expanded:[]});
        viewport=[0,0,Math.max(300,selected.layout.width),Math.max(250,selected.layout.height)];
      }
      if(!selected)throw new Error('当前没有可以导出的图形');
      const svg=diagramSvg(selected,viewport,getComputedStyle(document.querySelector('.eda-workspace')));
      let ok;
      if(format==='svg')ok=await window.erDesktop.exportAsset({name:'ER Diagram',extension:'svg',content:svg});
      else {
        const blob=await svgToPng(svg,viewport);
        if(format==='clipboard'){await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);ok=true;}
        else { const content=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});
          ok=await window.erDesktop.exportAsset({name:'ER Diagram',extension:'png',content}); }
      }
      if(ok)setMessage('图形已导出；模型内容与阅读位置未改变。');
    } catch(e){setError(e.message);} finally {setBusy(false);}
  };
  return <CanvasEditorDialog title="导出 ER 图" visible={open} footerNote="" onClose={()=>{if(!busy)setOpen(false);}}>
    <div className="desktop-form">
      <label>导出范围<select value={scope} onChange={e=>setScope(e.target.value)} disabled={busy}>
        <option value="view">当前视图</option><option value="domain" disabled={!location.domainId}>当前领域</option><option value="overview">完整总图（全部表）</option>
      </select></label>
      <label>格式<select value={format} onChange={e=>setFormat(e.target.value)} disabled={busy}><option value="svg">SVG</option><option value="png">PNG</option><option value="clipboard">复制 PNG 到剪贴板</option></select></label>
      <p>导出只包含图形，不包含工具栏。大型总图建议使用 SVG，PNG 会限制图片尺寸。</p>
      <button disabled={busy||!model.tables.length} onClick={run}>{busy?'正在导出…':'导出'}</button>
      {error&&<p role="alert">{tr(error)}</p>}{message&&<p role="status">{tr(message)}</p>}
    </div>
  </CanvasEditorDialog>;
}
