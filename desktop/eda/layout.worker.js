import { arrangeSchematic } from './layout.mjs';
import ELK from 'elkjs/lib/elk-api.js';
const elk=new ELK({workerFactory:()=>new Worker(new URL('./elk-engine.worker.js',import.meta.url),{type:'module'})});
self.onmessage=async({data})=>{try{self.postMessage({id:data.id,result:await arrangeSchematic(data.model,data.options,elk)});}
catch(error){self.postMessage({id:data.id,error:error.message||'ELK 布局失败'});}};
