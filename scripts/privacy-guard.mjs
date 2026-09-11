// Targeted publication guard. A clean result is not a complete secret audit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const includeDist=process.argv.includes('--include-dist');
const ignored=new Set(['.git','node_modules','work','release','test-results']);
const textTypes=/\.(?:js|jsx|cjs|mjs|json|md|txt|yml|yaml|html|css|sql|svg|patch|toml)$/i;
const rules=[
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token',/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/],
  ['AWS access key',/AKIA[0-9A-Z]{16}/],
  ['private network address',/(?<![\d.])(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?![\d.])/],
  ['personal absolute path',/\/Users\/[A-Za-z0-9_.-]+\//],
  ['credential URL',/https?:\/\/[^/\s:@]+:[^/\s@]+@/],
];
let files=0;const findings=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(ignored.has(entry.name)||(entry.name==='dist'&&!includeDist))continue;
    const file=path.join(dir,entry.name),rel=path.relative(root,file);
    if(entry.isSymbolicLink()){findings.push([rel,'unexpected symlink']);continue;}
    if(entry.isDirectory()){walk(file);continue;}
    if(/^(?:\.env)(?:$|\.)/.test(entry.name)||/\.(?:pfx|p12|pem|key|sqlite|db)$/i.test(entry.name))findings.push([rel,'private artifact filename']);
    if(!textTypes.test(entry.name)&&!['LICENSE','NOTICE','.gitignore','.gitattributes'].includes(entry.name))continue;
    files++;const body=fs.readFileSync(file,'utf8');
    for(const [name,pattern]of rules)if(pattern.test(body))findings.push([rel,name]);
  }
}
walk(root);
// Ignore local dependency caches on disk, but never let symlinks or caches enter
// the actual publishable Git index through a forced add or a directory-only glob.
try{
  const index=execFileSync('git',['ls-files','--stage','-z'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
  for(const item of index.split('\0').filter(Boolean)){
    const [meta,file]=item.split('\t');
    if(meta.startsWith('120000 '))findings.push([file,'tracked symlink']);
    if(/(^|\/)(node_modules|work|dist|release|test-results|private|user-data)(\/|$)/.test(file))
      findings.push([file,'tracked generated/private directory']);
  }
}catch{ /* The same guard also works before the initial local Git commit. */ }
if(findings.length){for(const [file,rule]of findings)console.error(rule+': '+file);process.exitCode=1;}
else console.log('Targeted publication guard: '+files+' text files checked; no matching findings. Human review remains required.');
