const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const document=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'../../examples/fulfillment.drawdb.json'),'utf8'));
const model=()=>{const d=document();return{tables:d.tables,relationships:d.relationships,groups:d.reviewGroups};};
test('explicit process metadata validates without inferring any flow from foreign keys',async()=>{
  const {validateProcessModel,bindingIssues}=await import('../process/definition.mjs'),d=document();
  assert.equal(validateProcessModel(null),null);assert.equal(validateProcessModel(d.processModel),d.processModel);
  assert.deepEqual(bindingIssues(d.processModel,d.tables),[]);
  const bad=structuredClone(d.processModel);bad.scenarios[0].flows[0].to='missing';assert.throws(()=>validateProcessModel(bad),/endpoint/);
  bad.scenarios[0].flows[0].to=bad.scenarios[0].steps[1].id;bad.scenarios[0].steps[1].bindings[0].access='execute';assert.throws(()=>validateProcessModel(bad),/binding/);
});
test('missing mapped fields remain reportable rather than deleting the process',async()=>{
  const {validateProcessModel,bindingIssues}=await import('../process/definition.mjs'),d=document(),before=JSON.stringify(d.processModel);
  d.tables=d.tables.filter(t=>t.id!=='orders');assert(bindingIssues(d.processModel,d.tables).length>0);
  validateProcessModel(d.processModel);assert.equal(JSON.stringify(d.processModel),before);
});
test('ER selection maps to activities and scenarios without one-table-one-step assumptions',async()=>{
  const {actionsForTable,processSelection}=await import('../process/definition.mjs');const d=document();
  assert(actionsForTable(d.processModel.scenarios[0],'orders').length>=3);
  assert(actionsForTable(d.processModel.scenarios[0],'orders','orders.status').length>=3);
  assert.equal(processSelection(d.processModel,'returns','restock').activity.id,'restock');
  assert.equal(processSelection(null,'','').scenario,null);
});
test('flow and mixed projections share source data, with distinct control, binding and ER edges',async()=>{
  const {projectProcess}=await import('../process/graph.mjs'),m=model(),s=document().processModel.scenarios[0],before=JSON.stringify(m);
  const flow=projectProcess(m,s,{mode:'flow'});assert.equal(flow.nodes.length,s.steps.length);assert(flow.edges.every(e=>e.kind==='process-flow'));
  const mixed=projectProcess(m,s,{mode:'mixed',scope:'focused',activityId:'create-order'});
  assert.equal(mixed.nodes.filter(n=>n.kind==='table').length,4);assert.equal(mixed.nodes.filter(n=>n.stepId).length,3);
  assert(mixed.edges.some(e=>e.kind==='process-binding'));assert(mixed.edges.some(e=>e.refs.length));assert.equal(mixed.totalModelTables,13);
  const {cardinalityBadges}=await import('../eda/cardinality.mjs');const badges=cardinalityBadges({projection:mixed,layout:{children:mixed.nodes.map((n,i)=>({...n,x:i*400,y:0}))}});
  assert(badges.every(b=>b.refs.length));assert.equal(JSON.stringify(m),before);
});
test('ELK routes both views, including a return loop, without changing the ER model',async()=>{
  const {arrangeProcess}=await import('../process/graph.mjs'),m=model(),d=document(),before=JSON.stringify(m);
  for(const options of [{scenario:d.processModel.scenarios[0],mode:'flow'}, {scenario:d.processModel.scenarios[0],mode:'mixed',scope:'focused',activityId:'create-order'}, {scenario:d.processModel.scenarios[1],mode:'flow'}, {scenario:d.processModel.scenarios[1],mode:'mixed',scope:'all'}]){
    const result=await arrangeProcess(m,options);assert(result.layout.width>0);assert.equal(result.layout.children.length,result.projection.nodes.length);
  }assert.equal(JSON.stringify(m),before);
});
test('process model survives v2 roundtrips and view positions remain per model and per mode',async()=>{
  const {versionModelDocument,migrateModelDocument}=await import('../renderer/model-format.mjs');const d=document(),saved=versionModelDocument(d);
  assert.equal(saved.schemaVersion,2);assert.deepEqual(migrateModelDocument(JSON.parse(JSON.stringify(saved))).processModel,d.processModel);
  const {cleanProcessReader,processReaderKey,processViewKey}=await import('../process/reader.mjs');
  assert.notEqual(processReaderKey('a'),processReaderKey('b'));assert.notEqual(processViewKey({mode:'flow',scenarioId:'x'}),processViewKey({mode:'mixed',scenarioId:'x'}));
  assert.equal(cleanProcessReader({mode:'invalid'}).mode,'er');assert.deepEqual(cleanProcessReader({views:{bad:[NaN,0,100,200]}}).views,{});
});
