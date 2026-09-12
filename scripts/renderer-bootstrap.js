import { loader } from '@monaco-editor/react';
import { db } from './data/db';
import { initializeLanguage } from 'er-wiki-locale';
import demo from './data/demo-fulfillment.json';

loader.config({paths:{vs:'/vendor/monaco'}});
export async function prepareDesktop(){
  const legacyLanguage=localStorage.getItem('erwiki.community.settings')?localStorage.getItem('i18nextLng'):null;
  const marker='erwiki.builtin.demo-fulfillment';
  if(localStorage.getItem(marker)!=='installed'){
    await db.transaction('rw',db.diagrams,async()=>{
      if(!await db.diagrams.where('diagramId').equals('demo-fulfillment').first())
        await db.diagrams.add({diagramId:'demo-fulfillment',name:demo.title,database:demo.database,tables:demo.tables,references:demo.relationships,
          reviewGroups:demo.reviewGroups,notes:[],areas:[],views:[],types:[],enums:[],pan:{x:0,y:0},zoom:0.4,gistId:'',loadedFromGistId:'',lastModified:new Date()});
    });
    localStorage.setItem(marker,'installed');
  }
  if(!localStorage.getItem('erwiki.community.settings')){
    const settings=JSON.parse(localStorage.getItem('settings')||'{}');
    localStorage.setItem('settings',JSON.stringify({...settings,tableWidth:420,showComments:false}));
    localStorage.setItem('erwiki.community.settings','1');
  }
  await initializeLanguage(legacyLanguage);
  if(location.pathname==='/'||location.pathname==='/editor')
    history.replaceState({},'','/editor/diagrams/demo-fulfillment');
}
