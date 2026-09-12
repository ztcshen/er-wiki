import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '@douyinfe/semi-ui';
import { useDiagram, useSettings, useSelect, useLayout } from '../../work/drawdb/src/hooks';
import { ObjectType, Tab } from '../../work/drawdb/src/data/constants';
import { modelGroups } from '../../work/drawdb/src/utils/tableGroups';
import GroupControls from '../../work/drawdb/src/components/EditorHeader/GroupControls';
import { domainsOf } from './model.mjs';
import EdaScene from './EdaScene';
import EdaEditors from './EdaEditors';
import FieldCodeReference from '../renderer/FieldCodeReference';
import { formatFieldType, chineseFieldName } from '../../work/drawdb/src/utils/fieldPresentation';
import { fieldEnumValues } from '../../work/drawdb/src/utils/fieldEnumValues';
import { useReadingSession } from './useReadingSession';
import { geometryKey, refreshLayoutContent } from './layout-content.mjs';
import { searchModel } from './reading-state.mjs';
import ReadingBookmarks from './ReadingBookmarks';
import DiagramExport from './DiagramExport';
import { tr } from '../i18n/renderer';
import './eda.css';

export default function EdaWorkspace({ modelId, ready }){
  const LEVELS=[['overview','全部表'],['system','领域概览'],['domain','领域内表'],['table','关联表'],['column','全部字段']];
  const {tables,relationships,reviewGroups,setGroupView,addTable}=useDiagram();
  const {settings,setSettings}=useSettings();const {setSelectedElement,setBulkSelectedElements}=useSelect();const {layout,setLayout}=useLayout();
  const [tools,setTools]=useState(null);
  const model=useMemo(()=>({tables,relationships,groups:modelGroups(reviewGroups,tables)}),[tables,relationships,reviewGroups]);
  const reading=useReadingSession(modelId,model,ready);
  const {level,domainId,tableId,selectedNet,selectedTable,selectedField,expanded,labels,bundle}=reading.location;
  const setLevel=reading.setPart('level'),setDomain=reading.setPart('domainId'),setTable=reading.setPart('tableId');
  const setNet=reading.setPart('selectedNet'),setSelectedTable=reading.setPart('selectedTable'),setExpanded=reading.setPart('expanded'),setField=reading.setPart('selectedField');
  const {view,setView}=reading;
  const [nonce,setNonce]=useState(0);
  const [rawResult,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const result=useMemo(()=>refreshLayoutContent(rawResult,model),[rawResult,model]);
  const [search,setSearch]=useState(''),[fieldNets,setFieldNets]=useState([]);const sequence=useRef(0),job=useRef(null);
  const viewKey=JSON.stringify([level,domainId,tableId,labels,bundle,expanded]);
  const shape=useMemo(()=>geometryKey(model,{level,domainId,tableId,labels,bundle,expanded}),[model,viewKey]);
  const layoutModel=useMemo(()=>model,[shape]);
  const requestKey=shape+viewKey+nonce;
  const [completedKey,setCompletedKey]=useState(null);
  const currentResult=completedKey===requestKey;
  const domains=useMemo(()=>domainsOf(model),[model]);
  useEffect(()=>{document.body.classList.add('eda-reading');setSelectedElement(s=>({...s,element:ObjectType.NONE,id:-1,open:false,openDialogue:false}));setBulkSelectedElements([]);
    return()=>document.body.classList.remove('eda-reading');},[setSelectedElement,setBulkSelectedElements]);
  const navigate=(...args)=>{setSearch('');setFieldNets([]);reading.navigate(...args);};
  useEffect(()=>{
    if(!ready||!tables.length){setResult(null);return;}
    const id=++sequence.current;setBusy(true);setError('');
    let worker;
    const delay=setTimeout(()=>{
    worker=new Worker(new URL('./layout.worker.js',import.meta.url),{type:'module'});
    const timeout=setTimeout(()=>{worker.terminate();if(sequence.current===id){setBusy(false);setError('布局超时，请缩小领域或重试。原模型未改变。');}},25000);
    job.current={worker,timeout};
    worker.onmessage=({data})=>{
      if(data.id!==sequence.current)return;clearTimeout(timeout);worker.terminate();setBusy(false);
      if(data.error){setError(data.error);return;}
      setResult(data.result);setCompletedKey(requestKey);
      if(!reading.rememberedView)setView([0,0,Math.max(300,data.result.layout.width||800),Math.max(250,data.result.layout.height||500)]);
    };
    worker.onerror=event=>{clearTimeout(timeout);worker.terminate();if(sequence.current===id){setBusy(false);setError(event.message||'布局引擎未能启动');}};
    worker.postMessage({id,model:layoutModel,options:{level,domainId,tableId,bundle,labels,expanded}});
    },150);
    return()=>{clearTimeout(delay);worker?.terminate();if(job.current?.worker===worker){clearTimeout(job.current?.timeout);job.current=null;}};
  },[layoutModel,ready,requestKey]);
  const net=currentResult?result?.projection.nets.find(n=>n.id===selectedNet):null;
  const infoTable=tables.find(t=>t.id===selectedTable);
  const fieldInfo=infoTable?.fields.find(f=>f.id===selectedField);
  const matches=useMemo(()=>searchModel(model,search),[model,search]);
  const currentDomain=domains.find(d=>d.id===domainId);
  const visibleTableCount=currentResult?result?.projection.nodes.filter(n=>n.kind==='table').length:null;
  const showDirectory=settings.edaDirectory!==false,showInspector=!!(net||infoTable);
  const clearSelection=()=>{setNet(null);setSelectedTable(null);setFieldNets([]);setField(null);setExpanded([]);};
  const fitView=()=>{if(result&&currentResult)setView([0,0,result.layout.width||800,result.layout.height||500]);};
  const zoomView=f=>setView(v=>{if(v[2]*f<100||v[2]*f>100000)return v;return [v[0]+v[2]*(1-f)/2,v[1]+v[3]*(1-f)/2,v[2]*f,v[3]*f];});
  const pickNode=node=>{
    if(node.kind==='domain')navigate('domain',node.domainId);
    else {setSelectedTable(node.tableId);setNet(null);setField(null);setFieldNets([]);}
  };
  const editTable=id=>{
    const t=tables.find(t=>t.id===id);if(!t)return;
    setTools(null);
    setSelectedElement(s=>({...s,element:ObjectType.TABLE,id,open:false,openDialogue:true,currentTab:Tab.TABLES}));
  };
  useEffect(()=>{
    const handle=({detail})=>{
      if(detail==='add-table'&&!layout.readOnly){navigate('overview');const id=addTable();setSelectedTable(id);setSelectedElement(s=>({...s,element:ObjectType.TABLE,id,open:false,openDialogue:true,currentTab:Tab.TABLES}));}
      else if(detail==='add-relationship'&&!layout.readOnly)setTools('relationship');
      else if(detail==='model'||detail==='code'){setGroupView({id:'',globalTransform:null});setSelectedElement(s=>({...s,element:ObjectType.NONE,open:false,openDialogue:false,currentTab:Tab.TABLES}));setLayout(s=>({...s,dbmlEditor:detail==='code'}));setTools('model');}
      else if(detail==='fit')fitView();
      else if(detail==='zoom-in'||detail==='zoom-out')zoomView(detail==='zoom-in'?1/1.2:1.2);
    };
    window.addEventListener('erwiki-eda-command',handle);return()=>window.removeEventListener('erwiki-eda-command',handle);
  });
  return <section className="eda-workspace" aria-label="EDA 分析工作台" data-eda-model={modelId}>
    <div className="eda-toolbar">
      <div className="eda-controls">
        <button className="eda-icon-button" aria-label="返回上次阅读位置" title="返回上次阅读位置" disabled={!reading.canBack} onClick={reading.back}><i className="bi bi-arrow-left" aria-hidden="true"/></button>
        <button className="eda-icon-button" aria-label={showDirectory?'收起目录':'展开目录'} aria-pressed={showDirectory} title="显示或收起目录" onClick={()=>setSettings(s=>({...s,edaDirectory:s.edaDirectory===false}))}><i className="bi bi-layout-sidebar" aria-hidden="true"/></button>
        {level!=='overview'&&<button className="eda-back-button" aria-label="返回全部表总图" onClick={()=>navigate('overview')}><i className="bi bi-arrow-left" aria-hidden="true"/>总图</button>}
        <select aria-label="原理图层级" title="图形层级" value={level} onChange={e=>{const next=e.target.value,target=['table','column'].includes(next)?(selectedTable??tableId??tables[0]?.id):null;navigate(next,['overview','system'].includes(next)?'':domainId,target);if(target!=null)setSelectedTable(target);}}>{LEVELS.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select>
        {currentDomain&&<span className="eda-scope-name" title={currentDomain.name}>{currentDomain.name}</span>}
        <span className="eda-model-count" data-eda-scope title={`完整模型：${tables.length} 张表，${relationships.length} 条关系；前一个数字为当前视图可见表数`}>{level==='system'?`${domains.length} 个领域`:`${visibleTableCount??'…'} / ${tables.length} 表`}<span> · {relationships.length} 条关系</span></span>
        <div className="eda-view-actions">
          <ReadingBookmarks session={reading}/>
          <button onClick={()=>setNonce(n=>n+1)} disabled={busy||!tables.length} title="重新整理正交连线，不修改模型坐标"><i className="bi bi-diagram-3" aria-hidden="true"/>整理</button>
          <Popover trigger="click" position="bottomRight" content={<div className="eda-display-panel">
            <strong>图形显示</strong>
            <label>关系显示<select aria-label="Net Label 模式" value={labels} onChange={e=>reading.setPart('labels')(e.target.value)}><option value="off">全部连线</option><option value="auto">跨域 / 长线使用标签</option><option value="all">全部使用标签</option></select></label>
            <label className="eda-display-check"><input type="checkbox" aria-label="Bus / Hub" checked={bundle} onChange={e=>reading.setPart('bundle')(e.target.checked)}/>合并关系线（Bus / Hub）</label>
            <label className="eda-display-check"><input type="checkbox" checked={settings.edaMetrics===true} onChange={e=>{const checked=e.target.checked;setSettings(s=>({...s,edaMetrics:checked}));}}/>显示布局指标</label>
            <small>显示设置自动记忆，不修改模型保存时间。</small>
            <details><summary>操作说明</summary><p>双击表编辑，拖动空白平移，滚轮缩放。点击领域深入查看，返回总图恢复全部表。</p><p>虚线含待核关联；实线也不等同于物理外键。点击关系或标签可查看依据及原始成员。</p></details>
          </div>}><button aria-label="图形显示设置"><i className="bi bi-sliders" aria-hidden="true"/>显示</button></Popover>
        </div>
      </div>
    </div>
    {reading.error&&<p role="alert" className="eda-warning">{tr(reading.error)}</p>}
    <div className="eda-body" data-directory={showDirectory} data-inspector={showInspector}>
      {showDirectory&&<aside className="eda-directory"><div className="eda-directory-heading"><strong>目录</strong><div className="eda-directory-tools"><GroupControls fit={()=>{}}/></div></div>
        <label><span className="visually-hidden">定位表或字段</span><input type="search" aria-label="搜索模型" placeholder="搜索表、字段、别名或枚举" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <div className="eda-directory-scroll">{search?(<>{!matches.length&&<p>没有匹配结果</p>}{matches.slice(0,200).map(({table:t,field:f})=><button key={`${t.id}:${f?.id??''}`} onClick={()=>navigate('column',domains.find(d=>d.tableIds.includes(t.id))?.id||'',t.id,{selectedTable:t.id,selectedField:f?.id??null})}>{t.name}{f?`.${f.name}`:''}<small>{(f?.reviewChineseName||f?.comment||t.comment||'').slice(0,80)}</small></button>)}{matches.length>200&&<small>仅显示前 200 项，请缩小搜索范围。</small>}</>):domains.map(d=><section key={d.id}>
          <button className="eda-domain-heading" aria-pressed={domainId===d.id} style={{borderLeftColor:d.color}} onClick={()=>navigate('domain',d.id)}>{d.id==='__unassigned__'?tr(d.name):d.name}<small>{d.tableIds.length}</small></button>
          {d.tableIds.map(id=>{const t=tables.find(t=>t.id===id);return <button key={id} className="eda-table-link" aria-current={selectedTable===id?'true':undefined} onClick={()=>{navigate('table',d.id,id);setSelectedTable(id);}} title={t.comment}>{t.name}</button>;})}
        </section>)}</div>
      </aside>}
      <div className="eda-canvas" id="canvas" data-eda-ready={ready&&result&&currentResult&&!busy&&!error?'true':undefined}>
        {result&&currentResult&&<EdaScene result={result} selectedNet={selectedNet} onNet={value=>{const ids=Array.isArray(value)?value:[value];setNet(ids[0]||null);setSelectedTable(null);setFieldNets(result.projection.nets.filter(n=>ids.includes(n.id)));}} onNode={pickNode} onEdit={editTable} view={view} onView={setView}
          onField={(tid,fid)=>{const found=result.projection.nets.filter(n=>n.targetTableId===tid&&n.targetFields.includes(fid)||n.members.some(r=>r.startTableId===tid&&(r.fields||[r]).some(p=>p.startFieldId===fid)));setFieldNets(found);setNet(found[0]?.id||null);setSelectedTable(tid);setField(fid);}}/>}
        {!tables.length&&<div className="eda-state">当前模型尚无表。使用“新增”添加表，或在“更多”中导入模型。</div>}
        {(busy||(result&&!currentResult&&!error))&&<div className="eda-state" role="status">正在整理关系…<button onClick={()=>{sequence.current++;job.current?.worker.terminate();clearTimeout(job.current?.timeout);job.current=null;setBusy(false);setResult(null);setError('已取消布局，原模型未改变。');}}>取消</button></div>}
        {error&&<div className="eda-state eda-error" role="alert">{tr(error)}<button onClick={()=>setNonce(n=>n+1)}>重试</button><button onClick={()=>setTools('model')}>打开模型编辑</button></div>}
        {result&&currentResult&&!busy&&!error&&<>
          {settings.edaMetrics===true?<div className="eda-metrics">交叉 {result.metrics.crossings} · 重叠 {result.metrics.overlaps} · 线长 {result.metrics.length} · 转角 {result.metrics.bends}<small>按此顺序比较 {result.candidates.length} 个候选，非全局最优</small></div>:!showInspector&&<span className="eda-canvas-hint">双击表编辑 · 拖动空白平移 · 滚轮缩放</span>}
          <div className="eda-canvas-controls" aria-label="图形导航"><button aria-label="缩小" title="缩小" onClick={()=>zoomView(1.2)}>−</button><button aria-label="适应窗口" title="适应窗口" onClick={fitView}><i className="bi bi-arrows-fullscreen" aria-hidden="true"/></button><button aria-label="放大" title="放大" onClick={()=>zoomView(1/1.2)}>+</button></div>
        </>}
      </div>
      {showInspector&&<aside className="eda-inspector"><div className="eda-inspector-heading"><strong>{net?'关系详情':'表详情'}</strong><button className="eda-icon-button" aria-label="关闭详情" title="关闭详情" onClick={clearSelection}>×</button></div>
        {fieldInfo&&<section className="eda-field-details" data-eda-field-details><h3>{fieldInfo.name}</h3><code>{formatFieldType(fieldInfo)}</code><p>{chineseFieldName(infoTable.name,fieldInfo.name,fieldInfo)}</p><p>{fieldInfo.comment||'未提供注释'}</p>
          <FieldCodeReference tableName={infoTable.name} field={fieldInfo}/>
          <p>默认值：{fieldInfo.default===''?'未设置':String(fieldInfo.default)}</p>{fieldEnumValues(infoTable.name,fieldInfo).values.map(v=><p key={v.value}><code>{v.value}</code> {v.label}</p>)}</section>}
        {fieldNets.length>1&&<div className="eda-network-options">此选择涉及 {fieldNets.length} 个网络：{fieldNets.map(n=><button key={n.id} onClick={()=>setNet(n.id)}>{n.code}</button>)}</div>}
        {net?<><h3>{net.code}<span className="eda-detail-count">{net.members.length} 条关系</span></h3><p className="eda-code">{net.name}</p>
          <button onClick={()=>{setExpanded(ids=>[...new Set([...ids,net.id])]);setLevel('table');setDomain('');setTable(net.targetTableId);}}>展开完整关系</button><button onClick={()=>{setNet(null);setExpanded([]);setFieldNets([]);}}>取消追踪</button>
          <div className="eda-member-list">{net.members.map(r=>{const a=tables.find(t=>t.id===r.startTableId),b=tables.find(t=>t.id===r.endTableId),pairs=r.fields?.length?r.fields:[r];return <article key={r.id} data-net-member={String(r.id)}>
            <div className="eda-member-heading"><button className="eda-text-link" onClick={()=>{navigate('column',domains.find(d=>d.tableIds.includes(a.id))?.id||'',a.id);setSelectedTable(a.id);}} title="查看源表字段">{a?.name}</button><button className="eda-icon-button" aria-label={`编辑关系 ${r.name}`} title="编辑关系" onClick={()=>setSelectedElement(s=>({...s,element:ObjectType.RELATIONSHIP,id:r.id,open:false,openDialogue:true}))}><i className="bi bi-pencil" aria-hidden="true"/></button></div>
            <p>{pairs.map(p=>`${a?.fields.find(f=>f.id===p.startFieldId)?.name} → ${b?.name}.${b?.fields.find(f=>f.id===p.endFieldId)?.name}`).join('；')}</p>
            <details className="eda-evidence"><summary>{r.reviewEvidence?.kind==='inferred'?'待核关联 · 查看依据':'关联依据'}</summary><small>{r.reviewEvidence?.kind==='physical'?'已记录物理约束':r.reviewEvidence?.description||'逻辑关系；物理约束与基数以原始定义为准'}</small></details>
          </article>;})}</div></>:
          infoTable?<><h3>{infoTable.name}</h3><p className="eda-detail-count">{infoTable.fields.length} 字段 · {infoTable.indices?.length||0} 索引</p><div className="eda-detail-actions"><button className="eda-primary-button" onClick={()=>editTable(infoTable.id)}>编辑表</button><button onClick={()=>{navigate('column',domainId,infoTable.id);setSelectedTable(infoTable.id);}}>全部字段</button></div><details className="eda-evidence" open><summary>表说明与来源</summary><p>{infoTable.comment||'未提供表注释'}</p></details></>:null}
      </aside>}
    </div>
    <EdaEditors tools={tools} setTools={setTools}/>
    <DiagramExport model={model} result={result} current={currentResult&&!busy&&!error} location={reading.location} view={view}/>
  </section>;
}
