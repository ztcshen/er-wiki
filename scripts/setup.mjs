import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const upstream=JSON.parse(fs.readFileSync(path.join(root,'upstream.json'),'utf8'));
const source=path.join(root,'work/drawdb');
fs.mkdirSync(path.dirname(source),{recursive:true});
if(!fs.existsSync(path.join(source,'.git'))){
  execFileSync('git',['clone','--no-checkout',upstream.repository,source],{stdio:'inherit'});
  execFileSync('git',['checkout','--detach',upstream.commit],{cwd:source,stdio:'inherit'});
}
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
if(head!==upstream.commit)throw new Error('Unexpected drawDB revision; use the pinned commit in upstream.json.');
const npm=process.platform==='win32'?'npm.cmd':'npm';
for(const cwd of [source,path.join(root,'desktop')]){
  const modules=path.join(cwd,'node_modules');
  if(fs.existsSync(modules)&&fs.lstatSync(modules).isSymbolicLink())
    throw new Error('Refusing npm ci through a node_modules symlink. Use a normal dependency install for setup.');
  execFileSync(npm,['ci','--no-audit','--no-fund'],{cwd,stdio:'inherit',shell:process.platform==='win32'});
}
