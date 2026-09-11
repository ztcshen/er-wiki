import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync,spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const upstream=JSON.parse(fs.readFileSync(path.join(root,'upstream.json'),'utf8'));
const source=path.join(root,'work/drawdb');
if(!fs.existsSync(path.join(source,'.git')))throw new Error('Run npm ci && npm run setup first.');
if(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim()!==upstream.commit)
  throw new Error('Unexpected upstream revision.');
const patch=path.join(root,upstream.patch);
if(spawnSync('git',['apply','--reverse','--check',patch],{cwd:source,encoding:'utf8'}).status!==0){
  execFileSync('git',['apply','--check',patch],{cwd:source,stdio:'inherit'});
  execFileSync('git',['apply',patch],{cwd:source,stdio:'inherit'});
}
fs.writeFileSync(path.join(source,'src/data/field-display-names.json'),JSON.stringify({common:{id:'标识',created_at:'创建时间',updated_at:'更新时间'},tables:{}}));
fs.writeFileSync(path.join(source,'src/data/field-enums.json'),JSON.stringify({fields:{},sets:{}}));
fs.copyFileSync(path.join(root,'examples/fulfillment.drawdb.json'),path.join(source,'src/data/demo-fulfillment.json'));
fs.copyFileSync(path.join(root,'scripts/renderer-bootstrap.js'),path.join(source,'src/desktop-bootstrap.js'));
let main=execFileSync('git',['show','HEAD:src/main.jsx'],{cwd:source,encoding:'utf8'});
main=main.replace('import { Analytics } from "@vercel/analytics/react";\n','').replace('    <Analytics />\n','');
main='import { prepareDesktop } from "./desktop-bootstrap";\n'+main;
main=main.replace('const root = ReactDOM','await prepareDesktop();\n\nconst root = ReactDOM');
fs.writeFileSync(path.join(source,'src/main.jsx'),main);
fs.writeFileSync(path.join(source,'index.html'),'<!doctype html><html lang="zh"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>ER Wiki</title><link rel="stylesheet" href="/vendor/bootstrap-icons/font/bootstrap-icons.css"/><link rel="stylesheet" href="/vendor/fontawesome/css/all.min.css"/></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n');
for(const [name,destination]of [['monaco-editor/min/vs','monaco'],['bootstrap-icons/font','bootstrap-icons/font'],['@fortawesome/fontawesome-free/css','fontawesome/css'],['@fortawesome/fontawesome-free/webfonts','fontawesome/webfonts']])
  fs.cpSync(path.join(root,'node_modules',name),path.join(source,'public/vendor',destination),{recursive:true});
