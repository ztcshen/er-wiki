import notes from '../models/field-notes.json';

const useful=(value,name)=>typeof value==='string'&&value.trim()!==''&&value.trim()!==name&&
  !['未命名','未命名字段','待核中文名','未提供注释','—'].includes(value.trim());

export function resolveFieldLabel(table,field,legacyLabel) {
  for(const value of [field.reviewChineseName,notes.tables[table]?.[field.name]?.label,legacyLabel])
    if(useful(value,field.name))return value.trim();
  if(typeof field.comment==='string'){
    const value=field.comment.split(/[：:;；，,\n]/)[0].trim();
    if(useful(value,field.name))return value.slice(0,24);
  }
  return '—';
}

export function fieldCodeNote(table,field) {
  return notes.tables[table]?.[field.name];
}
