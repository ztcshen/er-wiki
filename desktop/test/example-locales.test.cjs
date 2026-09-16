const {test}=require('node:test');
const assert=require('node:assert/strict');
test('official example locales preserve identity, topology and routed geometry',async()=>{
 const fs=await import('node:fs');
 const {localizeExample}=await import('../../scripts/localize-example.mjs');
 const {geometryKey,refreshLayoutContent}=await import('../eda/layout-content.mjs');
 const {projectModel}=await import('../eda/model.mjs');
 const zh=JSON.parse(fs.readFileSync(new URL('../../examples/fulfillment.zh.drawdb.json','file://'+__filename)));
 const en=JSON.parse(fs.readFileSync(new URL('../../examples/fulfillment.en.drawdb.json','file://'+__filename)));
 const messages=JSON.parse(fs.readFileSync(new URL('../../examples/fulfillment.en.messages.json','file://'+__filename)));
 assert.deepEqual(en,localizeExample(zh,messages));
 assert(!/\p{Script=Han}/u.test(JSON.stringify(en)));
 const shape=m=>({tables:m.tables,relationships:m.relationships,groups:m.reviewGroups});
 const scopes=[{level:'overview',labels:'off'},...zh.tables.map(t=>({level:'column',tableId:t.id,labels:'auto'})),...zh.reviewGroups.map(g=>({level:'domain',domainId:g.id}))];
 for(const options of scopes){
   assert.equal(geometryKey(shape(en),options),geometryKey(shape(zh),options));
   const result={projection:projectModel(shape(zh),options),layout:{}};
   const refreshed=refreshLayoutContent(result,shape(en));
   assert.equal(refreshed.layout,result.layout);
   assert(!/\p{Script=Han}/u.test(JSON.stringify(refreshed.projection)));
 }
 assert.deepEqual(en.tables.map(t=>[t.id,t.name,t.fields.map(f=>[f.id,f.name,f.type,f.size])]),zh.tables.map(t=>[t.id,t.name,t.fields.map(f=>[f.id,f.name,f.type,f.size])]));
 assert.throws(()=>localizeExample({comment:'遗漏'},messages),/Missing example translation/);
});
