import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { checkNavigation } from './check-navigation.mjs';
import { checkErReading } from './check-er-reading.mjs';

// Optional focused Electron smoke check. Uses an existing Playwright runtime;
// it never starts a browser or touches the installed application's profile.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const { _electron }=await import(process.env.ER_WIKI_PLAYWRIGHT_MODULE||'playwright');
const require=createRequire(path.join(root,'desktop/package.json'));
const version=JSON.parse(await fs.readFile(path.join(root,'desktop/package.json'),'utf8')).version;
const output=process.env.ER_WIKI_SMOKE_OUTPUT||await fs.mkdtemp(path.join(os.tmpdir(),'er-wiki-smoke-'));
await fs.mkdir(output,{recursive:true});
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'er-wiki-smoke-profile-'));
const errors=[];
const app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'desktop/main.cjs')],env:{...process.env,ER_WIKI_TEST_PROFILE:profile}});
const page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
try{
  await page.locator('[data-eda-ready="true"]').waitFor({timeout:30000});
  assert.equal(await page.locator('[data-node-kind="table"]').count(),13);
  const navigation=await app.evaluate(({BrowserWindow})=>{
    const contents=BrowserWindow.getAllWindows()[0].webContents;
    const check=url=>{let prevented=false;contents.emit('will-navigate',{preventDefault(){prevented=true;}},url);return prevented;};
    return {external:check('https://example.invalid/'),local:check('erwiki://app/editor/diagrams/demo-fulfillment')};
  });
  assert.deepEqual(navigation,{external:true,local:false});
  console.log('PASS: real native navigation handler blocks external destinations');
  console.log(JSON.stringify({stage:'initial',title:await page.title(),url:page.url(),profile,body:(await page.locator('body').innerText()).slice(0,2200)}));
  await page.screenshot({path:path.join(output,'initial.png')});
  const more=()=>page.getByRole('button',{name:/更多操作|More actions/}).click();
  const item=async text=>{await more();await page.getByText(text,{exact:true}).click();};
  const ready=()=>page.waitForFunction(()=>{
    const workspace=document.querySelector('.eda-workspace');return workspace?.dataset.edaModel===location.pathname.split('/').at(-1)&&!!workspace.querySelector('[data-eda-ready="true"]');
  },null,{timeout:30000});
  const record=()=>page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('drawDB');request.onerror=()=>reject(request.error);request.onsuccess=()=>{
      const db=request.result,query=db.transaction('diagrams').objectStore('diagrams').getAll();
      query.onsuccess=()=>{const model=query.result.find(x=>x.diagramId==='demo-fulfillment');db.close();resolve(model);};
    };
  }));
  const original=await record();
  await checkErReading({page,record});
  await checkNavigation({app,page,record,output});
  if (!process.argv.includes('--navigation-only')) {
  await page.evaluate(()=>{window.__smokeScene=document.querySelector('[data-eda-scene]');});
  await item('Settings…');
  await page.locator('.desktop-more-menu').first().waitFor({state:'hidden'});
  assert.equal((await page.evaluate(()=>window.erDesktop.getPreferences())).version,version);
  await page.getByRole('combobox',{name:'Interface language'}).selectOption('zh');
  await page.getByRole('button',{name:'保存模型',exact:true}).waitFor();
  assert.equal(await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.some(i=>i.label==='文件')),true);
  await page.screenshot({path:path.join(output,'settings-zh.png')});
  await page.getByRole('combobox',{name:'界面语言'}).selectOption('en');
  await page.getByRole('button',{name:'Save model',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__smokeScene===document.querySelector('[data-eda-scene]')),true);
  await page.screenshot({path:path.join(output,'settings-en.png')});
  await page.getByRole('button',{name:'Close editor',exact:true}).click();
  const translated=await record();assert.deepEqual(translated.tables,original.tables);assert.equal(translated.lastModified.getTime(),original.lastModified.getTime());
  console.log('PASS: language, native menus, same editing session, unchanged model');

  await page.getByRole('button',{name:'Collapse group 商品与库存',exact:true}).click();
  assert.equal(await page.locator('.eda-directory').getByRole('button',{name:'products',exact:true}).count(),0);
  assert.equal(await page.locator('[data-node-kind="table"]').count(),13);
  await page.getByRole('button',{name:'Quick search',exact:true}).click();
  await page.getByRole('combobox',{name:'Search actions or fields'}).fill('products.sku');
  await page.getByRole('option',{name:/^products\.sku/}).waitFor();
  await page.getByRole('combobox',{name:'Search actions or fields'}).press('Enter');
  await page.waitForFunction(()=>document.querySelector('[data-eda-field-details] h3')?.textContent==='sku');await ready();
  await page.waitForFunction(()=>Number(document.querySelector('[data-eda-scene]')?.getAttribute('viewBox').split(' ')[2])<1000);
  await page.getByRole('combobox',{name:'Schematic level'}).selectOption('overview');await ready();
  await page.getByRole('button',{name:'Expand group 商品与库存',exact:true}).click();
  assert.deepEqual((await record()).tables,original.tables);
  console.log('PASS: directory folding keeps global tables; keyboard palette finds and focuses a field');

  await page.getByRole('searchbox',{name:'Search model'}).fill('订单状态');
  await page.getByRole('button',{name:/^orders\.status/}).click();await ready();
  const orders=original.tables.find(t=>t.name==='orders');
  const geometry=()=>page.locator('[data-node-kind="table"]').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('data-table-id'),n.getAttribute('transform')]));
  const positions=await geometry();
  await page.locator(`[data-node-kind="table"][data-table-id="${orders.id}"]`).dblclick();
  const row=page.locator('[data-edit-field="status"]');await row.getByRole('button',{name:/Field details/}).click();
  await row.getByPlaceholder('Enter a display name or business alias').fill('流程状态');
  await page.getByRole('button',{name:'Close editor',exact:true}).click();await ready();
  assert.deepEqual(await geometry(),positions);
  await page.getByRole('button',{name:'Save model',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.desktop-save-status')?.textContent.includes('Saving'));
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  const remembered=await page.locator('[data-eda-scene]').getAttribute('viewBox');
  await page.getByRole('button',{name:'Reading bookmarks',exact:true}).click();
  await page.getByRole('textbox',{name:'Bookmark name'}).fill('Fulfillment review');
  await page.locator('.eda-bookmarks').getByRole('button',{name:'Add',exact:true}).click();
  await page.getByRole('button',{name:'Reading bookmarks',exact:true}).click();
  await item('Duplicate model');await page.waitForURL(url=>!url.pathname.endsWith('demo-fulfillment'));await ready();
  await page.getByRole('combobox',{name:'Switch model'}).selectOption('demo-fulfillment');await page.waitForURL('**/demo-fulfillment');await ready();
  await page.waitForFunction(expected=>document.querySelector('[data-eda-scene]')?.getAttribute('viewBox')===expected,remembered);
  await page.reload();await ready();assert.equal(await page.locator('[data-eda-scene]').getAttribute('viewBox'),remembered);
  await page.getByRole('button',{name:'Reading bookmarks',exact:true}).click();await page.getByRole('button',{name:'Fulfillment review',exact:true}).waitFor();
  await page.getByRole('button',{name:'Reading bookmarks',exact:true}).click();
  console.log('PASS: field search, display-name editing, stable geometry, model switch, reload, bookmark');

  await item('Backup and restore…');await page.getByRole('button',{name:'Back up current model',exact:true}).click();
  await page.locator('.desktop-backup-list article').first().waitFor();
  await page.locator('.desktop-backup-list').getByRole('button',{name:'Restore as copy',exact:true}).first().click();
  await page.waitForURL(url=>!url.pathname.endsWith('demo-fulfillment'));await ready();
  assert.equal(await page.locator('[data-node-kind="table"]').count(),13);
  const untouched=await record();assert.equal(untouched.diagramId,'demo-fulfillment');
  console.log('PASS: native backup and non-destructive restore');

  await item('Import SQL…');await page.getByRole('textbox',{name:'SQL DDL'}).fill("CREATE TABLE sample_parent (id BIGINT PRIMARY KEY); CREATE TABLE sample_child (id BIGINT PRIMARY KEY, parent_id BIGINT, FOREIGN KEY (parent_id) REFERENCES sample_parent(id));");
  await page.getByRole('button',{name:'Parse and preview',exact:true}).click();
  await page.getByRole('button',{name:'Import as new model',exact:true}).waitFor();
  assert.equal(await page.locator('.desktop-preview-list span').count(),2);
  const beforeImport=page.url();
  await page.getByRole('button',{name:'Import as new model',exact:true}).click();await page.waitForURL(url=>url.href!==beforeImport);await ready();
  assert.equal(await page.locator('[data-node-kind="table"]').count(),2);
  await page.getByRole('combobox',{name:'Switch model'}).selectOption('demo-fulfillment');await page.waitForURL('**/demo-fulfillment');await ready();
  console.log('PASS: local SQL parser worker and import-as-copy');

  await app.evaluate(({dialog},directory)=>{dialog.showSaveDialog=async(_window,options)=>({canceled:false,filePath:directory+'/'+options.defaultPath});},path.resolve(output));
  await item('Export ER diagram…');await page.locator('.desktop-form select').first().selectOption('overview');
  await page.locator('.desktop-form').getByRole('button',{name:'Export',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Diagram exported'}).waitFor();
  const svg=await fs.readFile(path.join(output,'ER Diagram.svg'),'utf8');
  assert(svg.startsWith('<svg'));assert.equal((svg.match(/data-node-kind="table"/g)||[]).length,13);assert(!svg.includes('eda-toolbar'));
  await page.locator('.desktop-form select').nth(1).selectOption('png');
  await page.locator('.desktop-form').getByRole('button',{name:'Export',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Diagram exported'}).waitFor();
  const png=await fs.readFile(path.join(output,'ER Diagram.png'));assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  await page.getByRole('button',{name:'Close editor',exact:true}).click();
  assert.equal(await page.locator('[data-eda-scene]').getAttribute('viewBox'),remembered);
  await page.screenshot({path:path.join(output,'reading-en.png')});
  await page.getByRole('button',{name:'Quick search',exact:true}).click();
  await page.getByRole('combobox',{name:'Search actions or fields'}).fill('DBML editor');
  await page.getByRole('option',{name:'DBML editor',exact:true}).click();
  await page.locator('.monaco-editor').first().waitFor({timeout:20000});
  await page.getByRole('button',{name:'Close editor',exact:true}).click();
  console.log('PASS: offline Monaco model editor');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log('PASS: full-model SVG/PNG exports without changing reading position');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,760));
  await page.getByRole('button',{name:'Quick search',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const headerBoxes=await page.locator('.desktop-header-identity,.desktop-quick-search,.desktop-header-actions').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
  for(let i=1;i<headerBoxes.length;i++)assert(headerBoxes[i-1].right<=headerBoxes[i].left+1,'Header controls overlap');
  await page.screenshot({path:path.join(output,'compact.png'),animations:'disabled'});
  console.log('PASS: compact desktop header at 980px');
  }
  assert.deepEqual(errors,[]);
  console.log('Focused Electron smoke passed. Artifacts: '+output);
}catch(error){
  await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  console.error(JSON.stringify({url:page.url(),errors,body:await page.locator('body').innerText().catch(()=>''),output}));throw error;
}finally{await app.close();}
