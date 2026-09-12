import { useEffect, useState } from 'react';
import { useParams } from '../../work/drawdb/node_modules/react-router-dom';
import { useDiagramList } from '../../work/drawdb/src/components/EditorHeader/Modal/Open/hooks/useDiagramList';
import { db } from '../../work/drawdb/src/data/db';
import { importModel } from './model-file';
import { builtinModels } from './builtin-models';
import { useLocale } from '../i18n/renderer';

let installing;
function ensureBuiltinModels() {
  if(!installing)installing=(async()=>{
    // A seed is installed once, never refreshed over a user's edited copy.
    for(const seed of builtinModels){
      const installedKey=`erwiki.builtin.${seed.id}`;
      if(localStorage.getItem(installedKey)==='installed')continue;
      const model=importModel(JSON.stringify(seed.model),`${seed.model.title}.json`);
      model.diagramId=seed.id;model.name=seed.model.title;
      await db.transaction('rw',db.diagrams,async()=>{
        if(!await db.diagrams.where('diagramId').equals(seed.id).first())await db.diagrams.add(model);
      });
      localStorage.setItem(installedKey,'installed');
    }
  })().catch(error=>{installing=null;throw error;});
  return installing;
}

export default function DesktopModelSwitcher() {
  const {i18n}=useLocale();
  const {id}=useParams(),{local}=useDiagramList();
  const [switching,setSwitching]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let mounted=true;ensureBuiltinModels().catch(e=>{if(mounted)setError(e.message);});return()=>{mounted=false;};},[]);
  useEffect(()=>{const done=()=>setSwitching(false);window.addEventListener('erwiki-switch-model-complete',done);return()=>window.removeEventListener('erwiki-switch-model-complete',done);},[]);
  const models=[...local].filter(m=>typeof m.diagramId==='string').sort((a,b)=>a.name.localeCompare(b.name,i18n.language));
  return <div className="desktop-model-switcher">
    <label><span className="visually-hidden">模型</span><select aria-label="切换模型" title={models.find(m=>m.diagramId===id)?.name||'切换模型'} disabled={switching} value={models.some(m=>m.diagramId===id)?id:''} onChange={e=>{
      const target=e.target.value;if(!target||target===id)return;setSwitching(true);
      window.dispatchEvent(new CustomEvent('erwiki-switch-model',{detail:target}));
    }}>
      <option value="" disabled>选择模型</option>
      {models.map(m=><option key={m.diagramId} value={m.diagramId}>{m.name}</option>)}
    </select></label>
    {error&&<small role="alert">内置模型载入失败：{error}</small>}
  </div>;
}
