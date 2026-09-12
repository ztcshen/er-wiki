import { useEffect, useRef, useState } from 'react';
import { sectionsOf } from './metrics.mjs';
import { clientPointToWorld, zoomAtPoint } from './camera.mjs';
import { formatFieldType, chineseFieldName } from '@drawdb/utils/fieldPresentation';
import { tr } from '../i18n/renderer';
import { matchesRelation, nodeRelations, relationCaption } from './cardinality.mjs';
import CardinalityLayer from './CardinalityLayer';

const fitText=(value,width,size=11)=>{
  let units=0,out='';for(const c of String(value||'')){units+=/[\u3400-\u9fff]/.test(c)?size:size*.58;if(units>width)return out+'…';out+=c;}return out;
};

const pathText=points=>points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ');
export default function EdaScene({result,selectedNet,selectedRelation=null,showCardinality=true,onNet,onNode,onEdit,onField,view,onView,renderNode,renderEdge,highlightBindings=[]}){
  const drag=useRef(null),svg=useRef(null);
  const updateView=useRef(onView);updateView.current=onView;
  useEffect(()=>{
    const element=svg.current;
    const wheel=event=>{
      event.preventDefault();
      const rect=element.getBoundingClientRect();
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect.height:1);
      const factor=Math.exp(Math.max(-.5,Math.min(.5,delta*.0015)));
      updateView.current(previous=>zoomAtPoint(previous,factor,clientPointToWorld(previous,rect,event.clientX,event.clientY)));
    };
    element.addEventListener('wheel',wheel,{passive:false});
    return()=>element.removeEventListener('wheel',wheel);
  },[]);
  const [hover,setHover]=useState(null);
  const nodeMeta=new Map(result.projection.nodes.map(n=>[n.id,n])),edgeMeta=new Map(result.projection.edges.map(e=>[e.id,e]));
  const relationMeta=new Map(result.projection.nets.flatMap(n=>n.members.map(r=>[r.id,r])));
  const active=hover?hover.netId:selectedNet;
  const activeRelation=hover?hover.relationId:selectedRelation;
  const activeNet=result.projection.nets.find(n=>n.id===active);
  const activeMembers=activeRelation!=null?[relationMeta.get(activeRelation)].filter(Boolean):activeNet?.members||[];
  const endpoint=(tid,fid)=>highlightBindings.some(b=>b.tableId===tid&&(b.fieldIds.includes(fid)||b.state?.fieldId===fid))||activeMembers.some(r=>(r.fields||[r]).some(p=>r.startTableId===tid&&p.startFieldId===fid||r.endTableId===tid&&p.endFieldId===fid));
  const tableNames=new Map(result.projection.tableNames?.map(t=>[t.id,t.name])||result.projection.nodes.filter(n=>n.kind==='table').map(n=>[n.tableId,n.title]));
  const nodeRefs=nodeRelations(result.projection);
  const describe=refs=>refs.map(id=>relationMeta.get(id)).filter(Boolean).map(r=>relationCaption(r,id=>tableNames.get(id)||String(id),tr)).join('\n');
  const hoverRelations=(ids,refs=[])=>setHover(ids?{netId:ids.length===1?ids[0]:null,relationId:refs.length===1?refs[0]:null}:null);
  const nodes=result.layout.children||[];
  const [x,y,w,h]=view;
  const netColor=id=>result.projection.nodes.find(n=>n.netId===id)?.color||'#536f8b';
  return <svg ref={svg} className="eda-scene" data-eda-scene viewBox={view.join(' ')}
    onPointerDown={event=>{if(event.button!==0||event.target.closest('[data-eda-node],[data-eda-wire],[data-eda-cardinality],[data-process-edge]'))return;
      drag.current={x:event.clientX,y:event.clientY,view:[...view]};svg.current.setPointerCapture(event.pointerId);}}
    onPointerMove={event=>{if(!drag.current)return;const rect=svg.current.getBoundingClientRect(),d=drag.current;
      const scale=Math.max(d.view[2]/rect.width,d.view[3]/rect.height);onView([d.view[0]-(event.clientX-d.x)*scale,d.view[1]-(event.clientY-d.y)*scale,d.view[2],d.view[3]]);}}
    onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
    aria-label="EDA 正交原理图">
    <defs><pattern id="eda-grid" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="var(--wiki-grid)" /></pattern></defs>
    <rect x={x} y={y} width={w} height={h} fill="url(#eda-grid)" />
    {(result.layout.edges||[]).map(edge=>{const m=edgeMeta.get(edge.id),highlight=matchesRelation(m,active,activeRelation),dim=(active||activeRelation!=null)&&!highlight,uncertain=m.refs.some(id=>relationMeta.get(id)?.reviewEvidence?.kind==='inferred');
      if(renderEdge&&m.kind.startsWith('process-'))return <g key={edge.id}>{renderEdge(edge,m)}</g>;
      return <g key={edge.id} data-eda-wire={edge.id} data-net-ids={JSON.stringify(m.netIds)} data-rel-ids={JSON.stringify(m.refs)}
        data-kind={m.kind} data-highlight={highlight?'true':'false'} opacity={dim?.15:1} role="button" tabIndex={0}
        aria-label={describe(m.refs)}
        onPointerEnter={()=>hoverRelations(m.netIds,m.refs)} onPointerLeave={()=>setHover(null)}
        onClick={()=>onNet(m.netIds,m.refs.length===1?m.refs[0]:null)} onKeyDown={e=>{if(e.key==='Enter')onNet(m.netIds,m.refs.length===1?m.refs[0]:null);}}>
        <title>{describe(m.refs)}</title>
        {sectionsOf(edge).map((points,index)=><g key={index}>
          <path d={pathText(points)} fill="none" stroke="transparent" strokeWidth="14" vectorEffect="non-scaling-stroke" />
          <path className="eda-wire" d={pathText(points)} fill="none" stroke={highlight?'var(--eda-active)':netColor(m.netIds[0])} strokeDasharray={uncertain?'6 4':undefined}
            strokeWidth={highlight?3:m.kind==='bus'?2.8:1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        </g>)}
      </g>;
    })}
    {nodes.map(node=>{const m=nodeMeta.get(node.id),virtual=['hub','junction','label'].includes(m.kind),refs=nodeRefs.get(node.id)||[],lit=m.netId&&matchesRelation({netIds:[m.netId],refs},active,activeRelation);
      const select=()=>virtual?onNet(m.netId,refs.length===1?refs[0]:null):onNode(m);
      return <g key={node.id} transform={`translate(${node.x},${node.y})`} data-eda-node={node.id} data-node-kind={m.kind}
        data-table-id={m.tableId===undefined?'':String(m.tableId)} data-net-id={m.netId||''} data-highlight={lit?'true':'false'}
        className="eda-node" role="button" tabIndex={0} aria-label={`${m.kind} ${m.title}`}
        onClick={select} onDoubleClick={event=>{if(m.kind==='table'){event.stopPropagation();onEdit(m.tableId);}}} onKeyDown={event=>{if(event.key==='Enter')select();}}>
        <title>{virtual?`${m.title}\n${describe(refs)}`:m.comment||m.title}</title>
        {renderNode&&['action','decision','event'].includes(m.kind)?renderNode(node,m):m.kind==='junction'?<><line x1="0" y1="12" x2="24" y2="12" stroke={lit?'var(--eda-active)':m.color} strokeWidth="2"/><circle cx="12" cy="12" r="4" fill={lit?'var(--eda-active)':m.color}/></>:
          m.kind==='hub'?<><path d="M 0 29 H 12 M 68 29 H 80" stroke={lit?'var(--eda-active)':m.color} strokeWidth="2"/>
            <path d="M 40 13 L 68 29 L 40 45 L 12 29 Z" fill="var(--wiki-card)" stroke={lit?'var(--eda-active)':m.color} strokeWidth="2" />
            <text x="40" y="33" textAnchor="middle" fontSize="11" fill="var(--wiki-ink)">{m.fanout}</text><text x="40" y="10" textAnchor="middle" className="eda-small">Hub · {m.title}</text></>:
          m.kind==='label'?<><path d={`M 0 0 H ${m.width-12} L ${m.width} 26 L ${m.width-12} 52 H 0 Z`} fill="var(--wiki-card)" stroke={lit?'var(--eda-active)':m.color} strokeWidth={lit?3:1.5}/>
            <text x="10" y="21" className="eda-label-code">{m.title} · Net Label</text><text x="10" y="40" className="eda-small">{m.subtitle.slice(0,25)}</text></>:
          <><rect width={node.width} height={node.height} rx="5" fill="var(--wiki-card)" stroke={highlightBindings.some(b=>b.tableId===m.tableId)?'var(--eda-active)':'var(--wiki-line)'} strokeWidth={highlightBindings.some(b=>b.tableId===m.tableId)?2:1} data-process-table-highlight={highlightBindings.some(b=>b.tableId===m.tableId)?'true':undefined}/>
            <rect width={node.width} height="4" rx="2" fill={m.color}/>
            <text x="12" y="26" className="eda-node-title">{fitText(m.kind==='domain'&&m.domainId==='__unassigned__'?tr(m.title):m.title,node.width-24,14)}</text>
            {m.kind==='domain'?<><text x="12" y="55" className="eda-small">{m.tableIds.length} 张表 · {m.internal.length} 条内部关系</text><text x="12" y="90" className="eda-small">点击进入领域 →</text></>:
              <><text x="12" y="47" className="eda-small">{fitText(m.domainUnassigned?tr(m.domainName):m.domainName,230)} · {m.totalFields} 个字段</text>
                {m.fields.length===0?<text x="12" y="87" className="eda-small">点击查看表 / 关键字段 →</text>:
                  <><rect x="1" y="55" width={node.width-2} height="23" fill="var(--wiki-surface)"/>
                    <text x="12" y="71" className="eda-small">字段名</text><text x="162" y="71" className="eda-small">类型</text><text x="270" y="71" className="eda-small">显示名称</text>
                    {m.fields.map((field,index)=><g key={field.id} data-eda-field={String(field.id)} data-eda-endpoint={endpoint(m.tableId,field.id)?'true':'false'} onClick={event=>{event.stopPropagation();onField(m.tableId,field.id);}}>
                      {endpoint(m.tableId,field.id)&&<rect x="1" y={78+index*30} width={node.width-2} height="30" fill="var(--eda-field-active)"/>}
                      <title>{field.name}: {field.comment||'未提供注释'}</title>
                      <line x1="0" x2={node.width} y1={78+index*30} y2={78+index*30} stroke="var(--wiki-line)"/>
                      <text x="12" y={98+index*30} className="eda-field-name">{field.primary?'⚿ ':''}{fitText(field.name,field.primary?130:142)}</text>
                      <text x="162" y={98+index*30} className="eda-field-type"><title>{formatFieldType(field)}</title>{formatFieldType(field).slice(0,18)}</text>
                      <text x="270" y={98+index*30} className="eda-small"><title>{chineseFieldName(m.title,field.name,field)}</title>{fitText(chineseFieldName(m.title,field.name,field),78)}</text>
                    </g>)}
                  </>}
              </>}
          </>}
        {(node.ports||[]).map(p=><circle key={p.id} cx={p.x} cy={p.y} r="2.5" fill={m.color||'#64748b'} pointerEvents="none" />)}
      </g>;
    })}
    {showCardinality&&<CardinalityLayer result={result} activeNet={active} activeRelation={activeRelation} onSelect={onNet} onHover={hoverRelations} describe={describe}/>}
  </svg>;
}
