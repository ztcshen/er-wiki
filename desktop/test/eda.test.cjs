const {test}=require('node:test');const assert=require('node:assert/strict');
const modelModule=import('../eda/model.mjs'),layoutModule=import('../eda/layout.mjs'),metricsModule=import('../eda/metrics.mjs');
const fixture=()=>({tables:[{id:'core',name:'core',fields:[{id:'core.id',name:'id',primary:true,type:'BIGINT'}]},...Array.from({length:6},(_,i)=>({id:`t${i}`,name:`t${i}`,fields:[{id:`t${i}.id`,name:'id',type:'BIGINT',primary:true},{id:`t${i}.core`,name:'core_id',type:'BIGINT'}]}))],
  relationships:Array.from({length:6},(_,i)=>({id:`r${i}`,startTableId:`t${i}`,startFieldId:`t${i}.core`,endTableId:'core',endFieldId:'core.id'})),groups:[]});
test('default overview includes every table regardless of scope, isolation or editor visibility',async()=>{
  const{projectModel}=await modelModule,m=fixture();m.tables[0].hidden=true;
  m.tables.push({id:'isolated',name:'isolated',hidden:true,fields:[]});
  m.groups=[{id:'subset',name:'Subset',tableIds:['t0','t1'],color:'#123456'}];
  const before=JSON.stringify(m);
  for(const options of [{},{level:'overview',domainId:'subset',tableId:'t0',labels:'all'},{level:'overview',domainId:'missing',labels:'off'}]){
    const p=projectModel(m,options),tables=p.nodes.filter(n=>n.kind==='table');
    assert.equal(p.level,'overview');assert.deepEqual(tables.map(n=>n.tableId),m.tables.map(t=>t.id));
    assert.deepEqual(new Set(p.covered),new Set(m.relationships.map(r=>r.id)));
    assert(tables.find(n=>n.tableId==='isolated').height>=110);
  }
  assert.equal(JSON.stringify(m),before);
});
test('nets use target identity and preserve every original relationship',async()=>{const{deriveNets,projectModel}=await modelModule;const model=fixture();
  assert.equal(deriveNets(model).length,1);assert.equal(deriveNets(model)[0].members.length,6);
  model.tables.push({id:'other',name:'other',fields:[{id:'other.id',name:'id'}]});model.relationships.push({id:'different',startTableId:'t0',startFieldId:'t0.core',endTableId:'other',endFieldId:'other.id'});
  assert.equal(deriveNets(model).length,2);const p=projectModel(model,{level:'table',labels:'all'});
  assert.equal(new Set(p.covered).size,7);assert.equal(new Set(p.nets.map(n=>n.code)).size,2);
});
test('Bus and high-fanout Hub replace six direct core exits with one trunk without altering model',async()=>{const{projectModel}=await modelModule;const m=fixture(),before=JSON.stringify(m);
  const p=projectModel(m,{level:'table',labels:'off',bundle:true});assert.equal(p.nodes.filter(n=>n.kind==='hub').length,1);assert.equal(p.edges.filter(e=>e.kind==='bus').length,1);assert.equal(p.covered.length,6);assert.equal(JSON.stringify(m),before);
  const plain=projectModel(m,{level:'table',labels:'off',bundle:false});assert.equal(plain.nodes.filter(n=>n.kind==='hub').length,0);assert.equal(plain.edges.length,6);
});
test('lexicographic order gives crossings precedence over all lower objectives',async()=>{const{compareScores}=await metricsModule;
  assert(compareScores({crossings:1,overlaps:9,length:10000,bends:99},{crossings:2,overlaps:0,length:1,bends:0})<0);
  assert(compareScores({crossings:1,overlaps:0,length:10000,bends:99},{crossings:1,overlaps:1,length:1,bends:0})<0);
});
test('ELK candidates produce finite orthogonal geometry and score in requested order',async()=>{const{arrangeSchematic}=await layoutModule,{compareScores,validateLayout}=await metricsModule;
  const m=fixture(),before=JSON.stringify(m),r=await arrangeSchematic(m,{level:'table',labels:'off',bundle:true,optimize:false});
  validateLayout(r.layout,r.projection);assert.equal(r.metrics.overlaps,0);assert.equal(r.candidates.length,2);
  assert(r.candidates.every(candidate=>candidate.direction==='RIGHT'));assert.deepEqual(r.candidates.map(candidate=>candidate.seed).sort(),[11,37]);
  for(const candidate of r.candidates)assert(compareScores(r.metrics,candidate.metrics)<=0);assert.equal(JSON.stringify(m),before);
});
test('hierarchical aggregation retains internal and cross-domain relationship coverage',async()=>{const{projectModel}=await modelModule;const m=fixture();m.groups=[{id:'a',name:'A',tableIds:['core','t0','t1'],color:'#123456'},{id:'b',name:'B',tableIds:['t2','t3','t4','t5'],color:'#654321'}];
  const r=projectModel(m,{level:'system'});assert.equal(r.nodes.length,2);assert.equal(r.covered.length,6);assert.equal(r.edges.length,1);assert.equal(r.edges[0].refs.length,4);
});
test('long logical paths become labels while all source members remain recoverable',async()=>{const{arrangeSchematic}=await layoutModule;const m=fixture(),before=JSON.stringify(m);
  const r=await arrangeSchematic(m,{level:'table',labels:'auto',bundle:true,longThreshold:100});
  assert(r.projection.nodes.some(n=>n.kind==='label'));assert.equal(r.projection.covered.length,6);assert.equal(JSON.stringify(m),before);
});
test('engine failure cannot partially write the input model',async()=>{const{arrangeSchematic}=await layoutModule;const m=fixture(),before=JSON.stringify(m);
  await assert.rejects(arrangeSchematic(m,{level:'table'},{layout:async()=>{throw new Error('fixture engine failure');}}),error=>error.code==='LAYOUT_NO_CANDIDATE'&&error.candidateErrors.length===2&&error.candidateErrors.every(candidate=>candidate.message==='fixture engine failure'));assert.equal(JSON.stringify(m),before);
});
