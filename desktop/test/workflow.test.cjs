const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createPreferences, resolveLanguage, translate } = require('../preferences.cjs');
const { createBackupStore } = require('../backups.cjs');
const { isNewer } = require('../updates.cjs');
const fixture = async () => JSON.parse(await fs.readFile(path.join(__dirname, '../../examples/fulfillment.drawdb.json'), 'utf8'));

test('legacy model migration preserves all user-authored fields and rejects future versions', async () => {
  const { migrateModelDocument } = await import('../renderer/model-format.mjs');
  const value = await fixture(), before = JSON.stringify(value), next = migrateModelDocument(value);
  assert.equal(next.schemaVersion, 2); assert.deepEqual(next.tables, value.tables); assert.deepEqual(next.relationships, value.relationships);
  assert.equal(JSON.stringify(value), before); assert.throws(() => migrateModelDocument({ ...value, schemaVersion: 999 }), /newer/);
  assert.deepEqual(migrateModelDocument(next), next);
});
test('reading state isolates models and restores selection, view and bookmark without writing model data', async () => {
  const r = await import('../eda/reading-state.mjs'), map = new Map(), storage = { getItem:k=>map.get(k), setItem:(k,v)=>map.set(k,v) };
  const location = r.cleanLocation({ level:'column', tableId:'orders', selectedTable:'orders', selectedField:'id' });
  const state = { location, views:{[r.scopeKey(location)]:[20,30,900,700]}, bookmarks:[{id:'one',name:'订单履约',location,view:[20,30,900,700]}] };
  r.saveReadingState(storage,'one',state); r.saveReadingState(storage,'two',{});
  assert.deepEqual(r.loadReadingState(storage,'one').views[r.scopeKey(location)],[20,30,900,700]);
  assert.equal(r.loadReadingState(storage,'one').bookmarks[0].name,'订单履约'); assert.equal(r.loadReadingState(storage,'two').bookmarks.length,0);
  map.set(r.readingKey('bad'),'broken'); assert.equal(r.loadReadingState(storage,'bad').location.level,'overview');
  assert.equal(r.normalizeReadingState({views:{invalid:[0,0,NaN,-1]}}).views.invalid,undefined);
  assert.equal(r.restoreLocation(location,{tables:[],groups:[]}).level,'overview');
});
test('presentation edits retain geometry, structural changes invalidate it, and content refresh retains coordinates', async () => {
  const { geometryKey, refreshLayoutContent } = await import('../eda/layout-content.mjs');
  const { projectModel } = await import('../eda/model.mjs');
  const data=await fixture(), model={tables:data.tables,relationships:data.relationships,groups:data.reviewGroups}, options={level:'overview',labels:'off',bundle:true};
  const before=geometryKey(model,options), projection=projectModel(model,options), result={projection,layout:{children:[{id:'sentinel',x:19,y:23}],edges:[]}};
  model.tables[0].comment='new comment';model.tables[0].name='renamed_table';model.tables[0].fields[0].reviewChineseName='业务别名';
  model.tables[0].fields[0].reviewEnumValues=[{value:'NEW',label:'待处理'}];
  assert.equal(geometryKey(model,options),before);
  const refreshed=refreshLayoutContent(result,model);assert.equal(refreshed.layout,result.layout);
  assert.equal(refreshed.projection.nodes.find(n=>n.tableId===model.tables[0].id).title,'renamed_table');
  model.tables.push({id:'extra',name:'extra',fields:[]});assert.notEqual(geometryKey(model,options),before);
});
test('field search includes comments, aliases and enum meanings', async () => {
  const {searchModel}=await import('../eda/reading-state.mjs');
  const model={tables:[{id:1,name:'orders',fields:[{id:2,name:'status',comment:'workflow',reviewChineseName:'订单状态',reviewEnumValues:[{value:'PENDING',label:'待发货'}]}]}]};
  for(const query of ['status','订单状态','待发货','pending','workflow'])assert.equal(searchModel(model,query)[0].field.id,2);
  assert.equal(searchModel(model,'absent').length,0);
});
test('backup snapshots are deduplicated, integrity checked and retained without changing originals', async () => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'er-wiki-backup-test-')),store=createBackupStore(directory),json=JSON.stringify(await fixture());
  const item={modelId:'synthetic',name:'Synthetic',json},first=await store.create(item,2);
  assert.equal(await store.create(item,2),first);assert.equal((await store.read(first)).json,json);
  const ids=await Promise.all([1,2].map(n=>store.create({...item,json:JSON.stringify({...JSON.parse(json),title:`v${n}`})},2)));
  assert.equal((await store.list('synthetic')).length,2);assert.equal((await store.list('other')).length,0);
  await assert.rejects(store.read('../escape'),/ID/);
  const file=path.join(directory,`${ids[1]}.json`),bad=JSON.parse(await fs.readFile(file,'utf8'));bad.json='{"tables":[],"relationships":[]}';await fs.writeFile(file,JSON.stringify(bad));
  await assert.rejects(store.read(ids[1]),/integrity/);
});
test('language preferences persist, validate input and serialize concurrent updates', async () => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'er-wiki-preferences-test-')),file=path.join(directory,'preferences.json');
  const preferences=createPreferences(file,()=> 'zh-CN');assert.equal(preferences.get().resolvedLanguage,'zh');
  await Promise.all([preferences.update({language:'en'}),preferences.update({backupCount:10})]);
  assert.equal(createPreferences(file,()=> 'zh-CN').get().resolvedLanguage,'en');assert.equal(preferences.get().backupCount,10);
  await assert.rejects(preferences.update({language:'ar'}),/Invalid/);
  assert.equal(resolveLanguage('system','fr'),'en');assert.equal(translate('en','保存'),'Save');assert.equal(translate('zh','保存'),'保存');
});
test('update comparison handles preview numbers and stable releases without downgrading', () => {
  assert(isNewer('v0.2.0-preview.10','0.2.0-preview.2'));assert(isNewer('v0.2.0','0.2.0-preview.10'));
  assert(!isNewer('v0.1.0','0.2.0-preview.1'));assert(!isNewer('not-a-version','0.2.0'));
});
