import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { packager } from '@electron/packager';
import { packageIcon } from './package-icon.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here);
const meta=JSON.parse(fs.readFileSync(path.join(here,'package.json'),'utf8'));
const upstream=JSON.parse(fs.readFileSync(path.join(root,'upstream.json'),'utf8'));
execFileSync(process.execPath,[path.join(root,'scripts/privacy-guard.mjs'),'--include-dist'],{cwd:root,stdio:'inherit'});
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'er-wiki-community-package-'));
for(const name of ['main.cjs','preload.cjs','security.cjs','files.cjs','preferences.cjs','backups.cjs','updates.cjs','i18n','package.json','dist'])
  fs.cpSync(path.join(here,name),path.join(stage,name),{recursive:true});
const source=path.join(stage,'source');fs.mkdirSync(source);
execFileSync('git',['-C',path.join(root,'work/drawdb'),'archive','--format=tar','--output',path.join(source,'drawdb-upstream.tar'),upstream.commit]);
for(const name of ['desktop','scripts','patches','examples','docs','LICENSE','NOTICE','README.md','README.zh-CN.md','package.json','package-lock.json','upstream.json']){
  fs.cpSync(path.join(root,name),path.join(source,name),{recursive:true,filter:value=>!/(?:^|\/)(?:node_modules|dist|release|test-results|\.git)(?:\/|$)/.test(path.relative(root,value))});
}
const identity=process.env.ER_WIKI_SIGN_IDENTITY;
const notarize=process.env.ER_WIKI_NOTARIZE==='1';
if(notarize&&(!identity||!process.env.ER_WIKI_NOTARY_PROFILE))throw new Error('Notarization requires a Developer ID identity and an existing notarytool keychain profile.');
const outputs=await packager({dir:stage,out:path.join(here,'release',meta.version),name:'ER Wiki Community',platform:process.platform,arch:process.arch,icon:packageIcon(here),
  osxSign:identity?{identity,optionsForFile:()=>({hardenedRuntime:true,entitlements:path.join(here,'assets/entitlements.plist')})}:undefined,
  electronVersion:meta.devDependencies.electron,appVersion:meta.version,appBundleId:'io.github.ztcshen.erwiki',appCopyright:'drawDB contributors and ER Wiki contributors — AGPL-3.0',
  asar:true,overwrite:true,download:{checksums:JSON.parse(fs.readFileSync(path.join(here,'node_modules/electron/checksums.json'),'utf8'))}});
if(process.platform==='darwin')for(const output of outputs){
  const app=path.join(output,'ER Wiki Community.app');
  if(!identity)execFileSync('codesign',['--force','--deep','--sign','-','--timestamp=none',app],{stdio:'inherit'});
  execFileSync('codesign',['--verify','--deep','--strict',app],{stdio:'inherit'});
  if(notarize){
    const archive=path.join(stage,'notarization.zip');execFileSync('ditto',['-c','-k','--keepParent',app,archive],{stdio:'inherit'});
    execFileSync('xcrun',['notarytool','submit',archive,'--keychain-profile',process.env.ER_WIKI_NOTARY_PROFILE,'--wait'],{stdio:'inherit'});
    execFileSync('xcrun',['stapler','staple',app],{stdio:'inherit'});
    execFileSync('xcrun',['stapler','validate',app],{stdio:'inherit'});
  }
}
console.log('Local community package: '+outputs.join(', '));
