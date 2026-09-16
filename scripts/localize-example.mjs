import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../examples/',import.meta.url);
export function localizeExample(model,messages) {
  const visit=value=>{
    if(typeof value==='string'&&/\p{Script=Han}/u.test(value)) {
      if(!Object.hasOwn(messages,value))throw new Error('Missing example translation: '+value);
      return messages[value];
    }
    if(Array.isArray(value))return value.map(visit);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v)]));
    return value;
  };
  return visit(model);
}
export function writeExampleLocales(){
  const original=JSON.parse(fs.readFileSync(new URL('fulfillment.drawdb.json',root)));
  const messages=JSON.parse(fs.readFileSync(new URL('fulfillment.en.messages.json',root)));
  const en=localizeExample(original,messages);
  if(/\p{Script=Han}/u.test(JSON.stringify(en)))throw new Error('English example contains untranslated text');
  for(const [language,model]of [['zh',original],['en',en]])fs.writeFileSync(new URL(`fulfillment.${language}.drawdb.json`,root),JSON.stringify(model,null,2)+'\n');
}
if(process.argv[1]===fileURLToPath(import.meta.url))writeExampleLocales();
