import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { packager } from '@electron/packager';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here);
const meta=JSON.parse(fs.readFileSync(path.join(here,'package.json'),'utf8'));
const upstream=JSON.parse(fs.readFileSync(path.join(root,'upstream.json'),'utf8'));
execFileSync(process.execPath,[path.join(root,'scripts/privacy-guard.mjs'),'--include-dist'],{cwd:root,stdio:'inherit'});
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'er-wiki-community-package-'));
for(const name of ['main.cjs','preload.cjs','security.cjs','files.cjs','package.json','dist'])
  fs.cpSync(path.join(here,name),path.join(stage,name),{recursive:true});
const source=path.join(stage,'source');fs.mkdirSync(source);
execFileSync('git',['-C',path.join(root,'work/drawdb'),'archive','--format=tar','--output',path.join(source,'drawdb-upstream.tar'),upstream.commit]);
for(const name of ['desktop','scripts','patches','examples','docs','LICENSE','NOTICE','README.md','README.zh-CN.md','package.json','package-lock.json','upstream.json']){
  fs.cpSync(path.join(root,name),path.join(source,name),{recursive:true,filter:value=>!/(?:^|\/)(?:node_modules|dist|release|test-results|\.git)(?:\/|$)/.test(path.relative(root,value))});
}
const outputs=await packager({dir:stage,out:path.join(here,'release',meta.version),name:'ER Wiki Community',platform:process.platform,arch:process.arch,
  electronVersion:meta.devDependencies.electron,appVersion:meta.version,appBundleId:'io.github.ztcshen.erwiki',appCopyright:'drawDB contributors and ER Wiki contributors — AGPL-3.0',
  asar:true,overwrite:true,download:{checksums:JSON.parse(fs.readFileSync(path.join(here,'node_modules/electron/checksums.json'),'utf8'))}});
if(process.platform==='darwin')for(const output of outputs){
  const app=path.join(output,'ER Wiki Community.app');
  execFileSync('codesign',['--force','--deep','--sign','-','--timestamp=none',app],{stdio:'inherit'});
  execFileSync('codesign',['--verify','--deep','--strict',app],{stdio:'inherit'});
}
console.log('Local community package: '+outputs.join(', '));
