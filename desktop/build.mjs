import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { integrateDesktop } from './integrate.mjs';
import { createUiLocalizer } from '../scripts/localize-ui.mjs';
import { rendererAliases } from './build/aliases.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here),source=path.join(root,'work/drawdb');
execFileSync(process.execPath,[path.join(root,'scripts/prepare-renderer.mjs')],{cwd:root,stdio:'inherit'});
const requireSource=createRequire(path.join(source,'package.json'));
const {build}=await import(pathToFileURL(requireSource.resolve('vite')).href);
const {default:react}=await import(pathToFileURL(requireSource.resolve('@vitejs/plugin-react')).href);
const integrate=integrateDesktop(here),localize=createUiLocalizer(root);
await build({root:source,configFile:false,plugins:[{name:'er-wiki-desktop',enforce:'pre',transform(code,id){return localize(integrate(code,id)||code,id);}},react()],
  resolve:{alias:rendererAliases(here,source)},
  build:{outDir:path.join(here,'dist'),emptyOutDir:true,sourcemap:false}});
fs.copyFileSync(path.join(root,'LICENSE'),path.join(here,'dist/LICENSE.txt'));
fs.copyFileSync(path.join(here,'licenses/cmdk.LICENSE.txt'),path.join(here,'dist/cmdk-LICENSE.txt'));
fs.copyFileSync(path.join(here,'node_modules/elkjs/LICENSE.md'),path.join(here,'dist/elkjs-LICENSE.md'));
fs.copyFileSync(path.join(root,'node_modules/libavoid-js/LICENSE'),path.join(here,'dist/libavoid-LICENSE.txt'));
for(const [from,to]of [['monaco-editor/LICENSE','monaco-LICENSE.txt'],['bootstrap-icons/LICENSE','bootstrap-icons-LICENSE.txt'],['@fortawesome/fontawesome-free/LICENSE.txt','fontawesome-LICENSE.txt']])
  fs.copyFileSync(path.join(root,'node_modules',from),path.join(here,'dist',to));
console.log('Community renderer built with fictional fulfillment data only.');
