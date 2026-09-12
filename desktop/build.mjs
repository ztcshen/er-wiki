import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { integrateDesktop } from './integrate.mjs';
import { createUiLocalizer } from '../scripts/localize-ui.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here),source=path.join(root,'work/drawdb');
execFileSync(process.execPath,[path.join(root,'scripts/prepare-renderer.mjs')],{cwd:root,stdio:'inherit'});
const requireSource=createRequire(path.join(source,'package.json'));
const {build}=await import(requireSource.resolve('vite'));
const {default:react}=await import(requireSource.resolve('@vitejs/plugin-react'));
const integrate=integrateDesktop(here),localize=createUiLocalizer(root);
await build({root:source,configFile:false,plugins:[{name:'er-wiki-desktop',enforce:'pre',transform(code,id){return localize(integrate(code,id)||code,id);}},react()],
  resolve:{alias:{'er-wiki-locale-provider':path.join(here,'i18n/LocaleBridge.jsx'),'er-wiki-locale':path.join(here,'i18n/renderer.js'),react:path.join(source,'node_modules/react'),'react-dom':path.join(source,'node_modules/react-dom'),'react-i18next':path.join(source,'node_modules/react-i18next'),'@douyinfe/semi-ui':path.join(source,'node_modules/@douyinfe/semi-ui')}},
  build:{outDir:path.join(here,'dist'),emptyOutDir:true,sourcemap:false}});
fs.copyFileSync(path.join(root,'LICENSE'),path.join(here,'dist/LICENSE.txt'));
fs.copyFileSync(path.join(here,'node_modules/elkjs/LICENSE.md'),path.join(here,'dist/elkjs-LICENSE.md'));
for(const [from,to]of [['monaco-editor/LICENSE','monaco-LICENSE.txt'],['bootstrap-icons/LICENSE','bootstrap-icons-LICENSE.txt'],['@fortawesome/fontawesome-free/LICENSE.txt','fontawesome-LICENSE.txt']])
  fs.copyFileSync(path.join(root,'node_modules',from),path.join(here,'dist',to));
console.log('Community renderer built with fictional fulfillment data only.');
