import { relationCondition, conditionLabel, conditionText } from './relation-condition.mjs';
import { tableBusinessName } from '../review/table-review.mjs';
const idOf = (kind, value) => `${kind}:${JSON.stringify(value)}`;
const pairsOf = r => r.fields?.length ? r.fields : [{ startFieldId:r.startFieldId,endFieldId:r.endFieldId }];
export const ALL_DOMAIN = '__unassigned__';

export function deriveNets(model) {
  const known = new Map(model.tables.map(t=>[t.id,t]));
  const nets = new Map();
  for(const r of model.relationships){
    const source=known.get(r.startTableId),target=known.get(r.endTableId),pairs=pairsOf(r);
    if(!source||!target||!pairs.every(p=>source.fields.some(f=>f.id===p.startFieldId)&&target.fields.some(f=>f.id===p.endFieldId)))continue;
    // Equal names are NOT equal nets. Composite target order is intentional.
    const condition=relationCondition(r,source);
    // Alternative business-type branches are NOT one electrical net with all
    // unconditional references to this PK. Keep each review relation traceable.
    const selfReference = source.id === target.id;
    const key=idOf('net',[target.id,pairs.map(p=>p.endFieldId),...(selfReference?['self',r.id]:[]),...(condition?[r.id,condition]:[])]);
    if(!nets.has(key))nets.set(key,{id:key,targetTableId:target.id,targetFields:pairs.map(p=>p.endFieldId),
      name:`${target.name}.${pairs.map(p=>target.fields.find(f=>f.id===p.endFieldId).name).join('+')}${condition?' · '+conditionText(r,source):''}`,
      condition,selfReference,members:[]});
    nets.get(key).members.push(r);
  }
  return [...nets.values()].sort((a,b)=>a.id.localeCompare(b.id)).map((n,i)=>({...n,code:`N${String(i+1).padStart(3,'0')}`}));
}

export function domainsOf(model) {
  const assigned=new Set(),domains=[];
  for(const g of model.groups||[]){
    const ids=g.tableIds.filter(id=>model.tables.some(t=>t.id===id)&&!assigned.has(id));
    ids.forEach(id=>assigned.add(id));
    if(ids.length)domains.push({...g,tableIds:ids});
  }
  const rest=model.tables.filter(t=>!assigned.has(t.id)).map(t=>t.id);
  if(rest.length)domains.push({id:ALL_DOMAIN,name:'未分组 / 公共结构',color:'#64748b',tableIds:rest});
  return domains;
}

export function projectModel(model, options={}, longCuts=new Set()) {
  const level=options.level||'overview',nets=deriveNets(model),domains=domainsOf(model);
  const domainByTable=new Map(domains.flatMap(d=>d.tableIds.map(id=>[id,d])));
  const nodes=new Map(),edges=[],covered=new Set(),expanded=new Set(options.expanded||[]);
  const addNode=n=>{if(!nodes.has(n.id))nodes.set(n.id,{ports:[],...n});return nodes.get(n.id);};
  const port=(node,key,side,y,badgeY)=>{
    const id=idOf('port',[node.id,key,side]);
    if(!node.ports.some(p=>p.id===id))node.ports.push({id,width:0,height:0,x:side==='EAST'?node.width:0,y,...(badgeY===undefined?{}:{badgeY}),
      layoutOptions:{'elk.port.side':side}});
    return id;
  };
  const connect=(source,target,net,refs,kind='wire')=>{
    const label=kind==='conditional'||kind==='self'&&relationCondition(refs[0])?conditionLabel(refs[0],model.tables.find(t=>t.id===refs[0].startTableId)):null;
    edges.push({id:`wire-${edges.length}`,sources:[source],targets:[target],
      netIds:Array.isArray(net)?net:[net.id],refs:refs.map(r=>r.id),kind,
      ...(label?{labels:[{id:`condition-${edges.length}`,...label}]}:{})});
  };
  if(level==='system'){
    for(const d of domains)addNode({id:idOf('domain',d.id),kind:'domain',domainId:d.id,title:d.name,color:d.color,width:300,height:112,
      tableIds:d.tableIds,internal:model.relationships.filter(r=>d.tableIds.includes(r.startTableId)&&d.tableIds.includes(r.endTableId)).map(r=>r.id)});
    const links=new Map();
    for(const n of nets)for(const r of n.members){
      covered.add(r.id);const a=domainByTable.get(r.endTableId),b=domainByTable.get(r.startTableId);
      if(a?.id===b?.id)continue;
      const key=JSON.stringify([a.id,b.id]);if(!links.has(key))links.set(key,{a,b,refs:[],nets:new Set()});
      links.get(key).refs.push(r);links.get(key).nets.add(n.id);
    }
    for(const l of links.values()){
      const a=nodes.get(idOf('domain',l.a.id)),b=nodes.get(idOf('domain',l.b.id));
      connect(port(a,'out','EAST',70),port(b,'in','WEST',70),[...l.nets],l.refs,'domain');
    }
    return finish();
  }
  // The complete ER overview is independent of drill-down and editor filters.
  // Including an editor-hidden table here never changes its saved hidden flag.
  let visible=new Set((level!=='overview'&&options.domainId?domains.find(d=>d.id===options.domainId)?.tableIds||[]:model.tables.map(t=>t.id)));
  if(['table','column'].includes(level)&&options.tableId!==undefined&&options.tableId!==null){
    visible=new Set([options.tableId]);
    for(const r of model.relationships)if(r.startTableId===options.tableId||r.endTableId===options.tableId){visible.add(r.startTableId);visible.add(r.endTableId);}
  }
  for(const n of nets)if(expanded.has(n.id))for(const r of n.members){visible.add(r.startTableId);visible.add(r.endTableId);}
  const touching=nets.filter(n=>n.members.some(r=>visible.has(r.startTableId)||visible.has(r.endTableId)));
  const referenced=new Map();
  for(const n of touching)for(const r of n.members)for(const p of pairsOf(r)){
    for(const[t,f]of [[r.startTableId,p.startFieldId],[r.endTableId,p.endFieldId]]){
      if(!referenced.has(t))referenced.set(t,new Set());referenced.get(t).add(f);
    }
  }
  for(const t of model.tables.filter(t=>visible.has(t.id)&&(level==='overview'||!t.hidden))){
    const fields=level==='domain'?[]:t.fields.filter(f=>level==='column'&&t.id===options.tableId||f.primary||referenced.get(t.id)?.has(f.id)||(Array.isArray(t.reviewOverviewFields)&&t.reviewOverviewFields.includes(f.name)));
    addNode({id:idOf('table',t.id),kind:'table',tableId:t.id,title:t.name,businessName:tableBusinessName(t),comment:t.comment||'',color:domainByTable.get(t.id)?.color||t.color||'#64748b',
      domainId:domainByTable.get(t.id)?.id,domainName:domainByTable.get(t.id)?.name||'',domainUnassigned:domainByTable.get(t.id)?.id===ALL_DOMAIN,width:360,height:fields.length?78+fields.length*30:110,fields,totalFields:t.fields.length,
      ...(level==='overview'&&t.reviewPlacement?{placement:t.reviewPlacement}:{})});
  }
  const conditionPorts=new Map();
  for(const net of touching)if(net.condition)for(const r of net.members){
    for(const [tid,fids,side]of [[r.endTableId,pairsOf(r).map(p=>p.endFieldId),'EAST'],[r.startTableId,pairsOf(r).map(p=>p.startFieldId),'WEST']]){
      const key=JSON.stringify([tid,fids,side]);
      if(!conditionPorts.has(key))conditionPorts.set(key,[]);
      conditionPorts.get(key).push(r.id);
    }
  }
  const tablePort=(tid,fids,side,relation=null,selfRole=null)=>{
    const n=nodes.get(idOf('table',tid));if(!n)return null;
    const indices=fids.map(fid=>n.fields.findIndex(f=>f.id===fid)).filter(i=>i>=0);
    let y=indices.length?78+30*(indices.reduce((s,i)=>s+i,0)/indices.length)+15:65;
    const badgeY=y;
    if(relation){
      const branches=conditionPorts.get(JSON.stringify([tid,fids,side]))||[relation.id];
      y+=branches.length===1?6:-8+16*branches.indexOf(relation.id)/(branches.length-1);
    }
    if (selfRole && !indices.length) y += selfRole.endsWith(':end') ? -10 : 10;
    const pid=port(n,selfRole?[fids,selfRole]:relation?[fids,relation.id]:fids,side,Math.min(n.height-8,y),relation?badgeY:undefined);
    n.ports.find(p=>p.id===pid).fieldIds=[...fids];
    if (selfRole) n.ports.find(p=>p.id===pid).selfReference = true;
    if (!indices.length && !relation) n.ports.find(p=>p.id===pid).aggregateId = idOf('summary-port', [n.id, side]);
    return pid;
  };
  const labelPort=(net,key,side)=>{
    const n=addNode({id:idOf('label',[net.id,key]),kind:'label',netId:net.id,title:net.code,subtitle:net.name,
      width:190,height:52,color:domainByTable.get(net.targetTableId)?.color||'#64748b'});
    return port(n,'label',side,26);
  };
  for(const net of touching){
    const members=net.members.filter(r=>nodes.has(idOf('table',r.startTableId))||nodes.has(idOf('table',r.endTableId)));
    if (net.selfReference) {
      for (const r of members) {
        const a=tablePort(r.endTableId,pairsOf(r).map(p=>p.endFieldId),'EAST',null,`${r.id}:end`);
        const b=tablePort(r.startTableId,pairsOf(r).map(p=>p.startFieldId),'EAST',null,`${r.id}:start`);
        if(a&&b){connect(a,b,net,[r],'self');covered.add(r.id);}
      }
      continue;
    }
    const wires=[],labels=[];
    for(const r of members){
      const owner=nodes.has(idOf('table',r.endTableId)),child=nodes.has(idOf('table',r.startTableId));
      const cross=domainByTable.get(r.startTableId)?.id!==domainByTable.get(r.endTableId)?.id;
      const cut=!owner||!child||(!net.condition&&!expanded.has(net.id)&&options.labels!=='off'&&
        (options.labels==='all'||cross||longCuts.has(r.id)));
      (cut?labels:wires).push(r);covered.add(r.id);
    }
    if(wires.length){
      const ownerPort=tablePort(net.targetTableId,net.targetFields,'EAST',net.condition?wires[0]:null);
      let branchPort=ownerPort;
      if(options.bundle!==false&&wires.length>=2){
        const high=wires.length>=4;
        const hub=addNode({id:idOf('hub',net.id),kind:high?'hub':'junction',netId:net.id,title:net.code,
          width:high?80:24,height:high?58:24,fanout:net.members.length,color:domainByTable.get(net.targetTableId)?.color||'#64748b'});
        connect(ownerPort,port(hub,'in','WEST',hub.height/2),net,wires,'bus');branchPort=port(hub,'out','EAST',hub.height/2);
      }
      for(const r of wires)connect(branchPort,tablePort(r.startTableId,pairsOf(r).map(p=>p.startFieldId),'WEST',net.condition?r:null),net,[r],net.condition?'conditional':'branch');
    }
    if(labels.length){
      const ownerPort=tablePort(net.targetTableId,net.targetFields,'EAST');
      if(ownerPort)connect(ownerPort,labelPort(net,'owner','WEST'),net,labels,'label-stub');
      for(const r of labels){
        const child=tablePort(r.startTableId,pairsOf(r).map(p=>p.startFieldId),'WEST');
        if(child)connect(labelPort(net,['child',r.id],'EAST'),child,net,[r],'label-stub');
      }
    }
  }
  return finish();
  function finish(){
    return {level,nodes:[...nodes.values()],edges,nets,domains,covered:[...covered],totalRelations:model.relationships.length,
      tableNames:model.tables.map(t=>({id:t.id,name:t.name}))};
  }
}
