import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Capture the shipped Electron UI, never a separate diagram renderer.
// The fresh, persistent demo profile is isolated from every normal user profile.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const meta=JSON.parse(await fs.readFile(path.join(root,'desktop/package.json'),'utf8'));
const executable=process.env.ER_WIKI_SNAPSHOT_EXECUTABLE||path.join(root,'desktop/release',meta.version,
  `ER Wiki Community-darwin-${process.arch}`,'ER Wiki Community.app/Contents/MacOS/ER Wiki Community');
await fs.access(executable);
const { _electron }=await import(process.env.ER_WIKI_PLAYWRIGHT_MODULE||'playwright');
const runs=path.join(root,'work/demo-snapshots');await fs.mkdir(runs,{recursive:true});
const run=await fs.mkdtemp(path.join(runs,'capture-')),profile=path.join(run,'profile');
await fs.mkdir(profile);
const output=path.join(root,'docs/images');await fs.mkdir(output,{recursive:true});
const input=await fs.readFile(path.join(root,'examples/fulfillment.drawdb.json'),'utf8'),demo=JSON.parse(input);
const errors=[],images=[];
const environment={...process.env,ER_WIKI_TEST_PROFILE:profile};
const app=await _electron.launch({executablePath:executable,env:environment});
const page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.waitForFunction(()=>{
  const workspace=document.querySelector('[data-eda-model="demo-fulfillment"]');
  return !!workspace?.querySelector('[data-eda-ready="true"]');
},null,{timeout:30000});
const more=()=>page.getByRole('button',{name:/^(更多操作|More actions)$/}).click();
const closeEditor=()=>page.getByRole('button',{name:/^(关闭编辑器|Close editor)$/}).click();
const overview=async()=>{
  await page.getByRole('combobox',{name:/^(原理图层级|Schematic level)$/}).selectOption('overview');await ready();
  await page.getByRole('button',{name:/^(适应窗口|Fit to window)$/}).click();
  assert.equal(await page.locator('[data-node-kind="table"]').count(),demo.tables.length);
};
const readModel=()=>page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('drawDB');request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const database=request.result,query=database.transaction('diagrams').objectStore('diagrams').getAll();
    query.onsuccess=()=>{database.close();resolve(query.result.find(x=>x.diagramId==='demo-fulfillment'));};query.onerror=()=>reject(query.error);};
}));
const capture=async(name,description)=>{
  await page.mouse.move(20,70);
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,name),scale:'css',animations:'disabled'});
  images.push({file:name,description,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight}))});
};
try{
  assert.equal(await app.evaluate(({app})=>app.isPackaged),true);
  await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.setContentSize(1440,900);window.webContents.setZoomFactor(1);});
  await ready();
  const version=(await page.evaluate(()=>window.erDesktop.getPreferences())).version;assert.equal(version,meta.version);
  const initial=await readModel();
  assert.deepEqual(initial.tables,demo.tables);assert.deepEqual(initial.references,demo.relationships);assert.deepEqual(initial.reviewGroups,demo.reviewGroups);
  const require=createRequire(path.join(root,'desktop/package.json'));
  const {extractFile}=await import(require.resolve('@electron/asar'));
  const archive=await app.evaluate(({app})=>app.getAppPath());
  const sourceHash=createHash('sha256').update(extractFile(archive,'source/desktop/eda/EdaScene.jsx')).digest('hex');
  assert.equal(sourceHash,createHash('sha256').update(await fs.readFile(path.join(root,'desktop/eda/EdaScene.jsx'))).digest('hex'));
  const runtimeFiles=['desktop/main.cjs','desktop/preload.cjs','desktop/security.cjs','desktop/files.cjs',
    'desktop/backups.cjs','desktop/preferences.cjs','desktop/updates.cjs','desktop/integrate.mjs','desktop/build.mjs',
    'scripts/localize-ui.mjs','scripts/prepare-renderer.mjs','scripts/renderer-bootstrap.js'];
  for(const directory of ['desktop/native','desktop/eda','desktop/renderer','desktop/i18n','desktop/build'])
    for(const file of await fs.readdir(path.join(root,directory),{recursive:true}))
      if(/\.(?:cjs|mjs|js|jsx|json|css)$/.test(file))runtimeFiles.push(directory+'/'+file.replaceAll('\\','/'));
  const sourceDigests=[];
  for(const file of runtimeFiles.sort()){
    const actual=createHash('sha256').update(extractFile(archive,'source/'+file)).digest('hex');
    assert.equal(actual,createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex'),`Repackage before capture: ${file}`);
    sourceDigests.push(file+':'+actual);
  }
  const runtimeSourceSha256=createHash('sha256').update(sourceDigests.join('\n')).digest('hex');
  for(const language of ['en','zh']){
    await more();await page.getByText(/^(Settings…|设置…)$/).click();
    await page.getByRole('combobox',{name:/^(Interface language|界面语言)$/}).selectOption(language);
    await page.waitForFunction(value=>document.documentElement.lang===value,language);
    await page.getByRole('combobox',{name:/^(Appearance|外观)$/}).selectOption('light');
    await closeEditor();await overview();
    await capture(`fulfillment-desktop-${language}.png`,`${language}: actual desktop, all 13 tables`);
    await page.locator('.eda-directory').getByRole('button',{name:'orders',exact:true}).click();await ready();
    await page.getByRole('button',{name:/^(Edit table|编辑表)$/}).click();
    await page.locator('[data-edit-field="status"]').waitFor();
    await capture(`fulfillment-editor-${language}.png`,`${language}: actual orders table editor, three columns`);
    await closeEditor();
    await page.getByRole('button',{name:/^(Quick search|快速查找)$/}).click();
    await page.getByRole('combobox',{name:/^(Search actions or fields|搜索操作或表字段)$/}).fill('orders.status');
    await page.getByRole('option',{name:/^orders\.status/}).click();await ready();
    await page.waitForFunction(()=>Number(document.querySelector('[data-eda-scene]').getAttribute('viewBox').split(' ')[2])<1000);
    await capture(`fulfillment-focus-${language}.png`,`${language}: actual focused field and navigation minimap`);
    await overview();
    await page.getByRole('button',{name:/^(Quick search|快速查找)$/}).click();
    await page.getByRole('combobox',{name:/^(Search actions or fields|搜索操作或表字段)$/}).fill('orders.status');
    await page.getByRole('option',{name:/^orders\.status/}).waitFor();
    await capture(`fulfillment-search-${language}.png`,`${language}: actual quick search, qualified field lookup`);
    await closeEditor();
  }
  await overview();
  // Automate only the native destination chooser; the app's own export path renders the SVG.
  const exported=path.join(run,'fulfillment.svg');
  await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},exported);
  await more();await page.getByText('导出 ER 图…',{exact:true}).click();
  await page.locator('.desktop-form select').first().selectOption('overview');
  await page.locator('.desktop-form select').nth(1).selectOption('svg');
  await page.locator('.desktop-form').getByRole('button',{name:'导出',exact:true}).click();
  await page.getByRole('status').filter({hasText:'图形已导出'}).waitFor();
  const svg=await fs.readFile(exported,'utf8');
  assert.equal((svg.match(/data-node-kind="table"/g)||[]).length,demo.tables.length);
  assert(svg.includes('显示名称'));assert(!svg.includes('eda-toolbar'));assert(!svg.includes('eda-minimap'));
  await fs.copyFile(exported,path.join(output,'fulfillment.svg'));
  await closeEditor();
  const saved=await readModel();
  assert.deepEqual(saved.tables,demo.tables);assert.deepEqual(saved.references,demo.relationships);assert.deepEqual(saved.reviewGroups,demo.reviewGroups);
  assert.equal(saved.lastModified.getTime(),initial.lastModified.getTime());assert.deepEqual(errors,[]);
  const manifest={capturedAt:new Date().toISOString(),application:'ER Wiki Community',applicationVersion:version,
    sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),rendererSourceSha256:sourceHash,runtimeSourceSha256,
    model:'examples/fulfillment.drawdb.json',modelSha256:createHash('sha256').update(input).digest('hex'),tables:demo.tables.length,relationships:demo.relationships.length,
    method:'Unmodified Electron webContents screenshots; SVG exported through the application UI.',images,svg:'fulfillment.svg'};
  await fs.writeFile(path.join(output,'fulfillment-snapshot.json'),JSON.stringify(manifest,null,2)+'\n');
  await fs.writeFile(path.join(runs,'latest.json'),JSON.stringify({profile:path.relative(root,profile),application:executable},null,2)+'\n');
  console.log(JSON.stringify({captured:images.map(x=>x.file),tables:demo.tables.length,relationships:demo.relationships.length,profile:path.relative(root,profile)}));
}catch(error){await page.screenshot({path:path.join(run,'failure.png')}).catch(()=>{});console.error({errors,run});throw error;}
finally{await app.close();}
if(process.argv.includes('--open'))spawn(executable,[],{env:environment,detached:true,stdio:'ignore'}).unref();
