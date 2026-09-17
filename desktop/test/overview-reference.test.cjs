const {test}=require('node:test');
const assert=require('node:assert/strict');
test('overview references preserve conditional relationships and expand back to wires',async()=>{
 const {projectModel}=await import('../eda/model.mjs');
 const model={tables:[{id:'a',name:'parent',fields:[{id:'a.id',name:'id',primary:true}]},{id:'b',name:'event',fields:[{id:'b.id',name:'id',primary:true},{id:'b.business_id',name:'business_id'},{id:'b.business_type',name:'business_type'}]}],groups:[{id:'one',name:'One',tableIds:['a']},{id:'two',name:'Two',tableIds:['b']}],relationships:[{id:'r',startTableId:'b',endTableId:'a',startFieldId:'b.business_id',endFieldId:'a.id',reviewDisplay:'reference',reviewEvidence:{kind:'logical',condition:{field:'business_type',value:'PARENT'}}}]};
 const before=JSON.stringify(model);
 const p=projectModel(model,{level:'overview',labels:'off'});
 assert.deepEqual(p.covered,['r']);assert.equal(p.totalRelations,1);
 assert.equal(p.edges.filter(e=>e.kind==='conditional').length,0);
 assert.equal(p.edges.filter(e=>e.kind==='label-stub').length,2);
 assert(p.edges.every(e=>e.refs.includes('r')));
 const net=p.nets[0];assert(net.condition);
 assert(projectModel(model,{level:'overview',labels:'off',expanded:[net.id]}).edges.some(e=>e.kind==='conditional'));
 assert(projectModel(model,{level:'table',tableId:'b',labels:'off'}).edges.some(e=>e.kind==='conditional'));
 assert.equal(JSON.stringify(model),before);
});
test('unannotated relations keep legacy wires',async()=>{
 const {projectModel}=await import('../eda/model.mjs');
 const m={tables:[{id:'a',name:'a',fields:[{id:'id',name:'id',primary:true}]},{id:'b',name:'b',fields:[{id:'id',name:'id',primary:true},{id:'fk',name:'fk'}]}],groups:[],relationships:[{id:'r',startTableId:'b',endTableId:'a',startFieldId:'fk',endFieldId:'id'}]};
 assert(projectModel(m,{level:'overview',labels:'off'}).edges.some(e=>e.kind==='branch'));
});
