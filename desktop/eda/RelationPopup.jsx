import {useEffect,useRef,useState} from 'react';
import {cardinalityOf} from './cardinality.mjs';
import {conditionText} from './relation-condition.mjs';
import {relationNatureLabel} from '../review/relation-semantics.mjs';
import './relation-popup.css';

export default function RelationPopup({request,tables,relationships,onClose}) {
  const ref=useRef(null),[index,setIndex]=useState(0);
  const members=request.refs.map(id=>relationships.find(r=>r.id===id)).filter(Boolean);
  const relation=members[index]||members[0];
  useEffect(()=>{
    const dialog=ref.current,previous=document.activeElement;
    dialog.showModal();
    return ()=>{dialog.close();if(previous?.isConnected)previous.focus();};
  },[]);
  const source=tables.find(t=>t.id===relation?.startTableId),target=tables.find(t=>t.id===relation?.endTableId);
  const card=cardinalityOf(relation);
  const explanation=card.start==='N'&&card.end==='1'
    ? `一条 ${target?.name} 记录可以关联多条 ${source?.name} 记录；每条 ${source?.name} 记录关联至一条 ${target?.name} 记录。`
    : card.start==='1'&&card.end==='N'
      ? `一条 ${source?.name} 记录可以关联多条 ${target?.name} 记录。`
      : card.start==='1'&&card.end==='1'?'两张表的记录一对一关联。'
        : card.start==='N'&&card.end==='N'?'两端都可以关联多条记录。':'尚未配置明确的关系基数。';
  return <dialog ref={ref} className="eda-relation-popup" aria-labelledby="relation-popup-title"
    style={{left:Math.max(12,Math.min(request.x,window.innerWidth-492)),top:Math.max(12,Math.min(request.y,window.innerHeight-450))}}
    onCancel={onClose} onClick={e=>{if(e.target===ref.current){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <header><strong id="relation-popup-title">关系说明</strong><button autoFocus aria-label="关闭关系说明" onClick={onClose}>×</button></header>
    {members.length>1&&<label>此连线包含 {members.length} 条关系<select aria-label="选择关联关系" value={index} onChange={e=>setIndex(Number(e.target.value))}>{members.map((r,i)=><option key={r.id} value={i}>{r.name||String(r.id)}</option>)}</select></label>}
    {relation?<><h3>{source?.name} <span>{card.start} : {card.end}</span> {target?.name}</h3>
    <p>{explanation}</p><small>表示关联基数，不代表记录都成功、同时有效或必须存在。</small>
    <div className="eda-relation-mapping">{(relation.fields?.length?relation.fields:[relation]).map((pair,i)=><p key={i}>{source?.name}.{source?.fields.find(f=>f.id===pair.startFieldId)?.name} → {target?.name}.{target?.fields.find(f=>f.id===pair.endFieldId)?.name}</p>)}</div>
    <p>{relationNatureLabel(relation,source)}</p>
    {conditionText(relation,source)&&<p>关联条件：{conditionText(relation,source)}</p>}
    <strong>关联依据</strong><p>{relation.reviewEvidence?.description||'尚未填写业务说明，暂不推断额外业务含义。'}</p>
    </>:<p>此关系已不存在。</p>}
  </dialog>;
}
