import { Parser } from '../../work/drawdb/node_modules/node-sql-parser';
import { importSQL } from '../../work/drawdb/src/utils/importSQL';
import { versionModelDocument } from './model-format.mjs';

self.onmessage = ({data}) => {
  try {
    const ast = new Parser().astify(data.sql, {database:data.database});
    const statements = Array.isArray(ast) ? ast : [ast];
    const diagram = importSQL(ast,data.database,data.database);
    if(!diagram.tables.length)throw new Error('没有解析到 CREATE TABLE，请检查 SQL 方言');
    diagram.relationships=diagram.relationships.map(r=>({...r,reviewEvidence:{kind:'physical',description:'Imported from SQL DDL'}}));
    const document = versionModelDocument({...diagram,title:data.name||'SQL model',database:data.database,notes:[],subjectAreas:[],reviewGroups:[]});
    self.postMessage({document,ignored:statements.filter(s=>s.type!=='create'||s.keyword!=='table').length});
  } catch(error){self.postMessage({error:error.message});}
};
