import { jsonDiagramIsValid } from '../../work/drawdb/src/utils/validateSchema';
import { modelGroups, validateGroups } from '../../work/drawdb/src/utils/tableGroups';
import { databases } from '../../work/drawdb/src/data/databases';
import { migrateModelDocument, versionModelDocument } from './model-format.mjs';
import { tr } from '../i18n/renderer';

export function importModel(json, filename) {
  const data = migrateModelDocument(JSON.parse(json));
  if (!jsonDiagramIsValid(data) || !Object.hasOwn(databases, data.database || 'generic')) {
    throw new Error('不是有效的 drawDB 模型 JSON，请从浏览器的文件菜单导出 JSON 后重试');
  }
  validateGroups(data.reviewGroups, data.tables);
  const tableIds = new Set();
  for (const table of data.tables) {
    if (tableIds.has(table.id)) throw new Error('模型含有重复的表 ID');
    tableIds.add(table.id);
    if (new Set(table.fields.map(field => field.id)).size !== table.fields.length) {
      throw new Error('模型含有重复的字段 ID');
    }
  }
  for (const relation of data.relationships) {
    const start = data.tables.find(table => table.id === relation.startTableId);
    const end = data.tables.find(table => table.id === relation.endTableId);
    const pairs = relation.fields?.length ? relation.fields : [relation];
    if (!start || !end || !pairs.every(pair =>
      start.fields.some(field => field.id === pair.startFieldId) &&
      end.fields.some(field => field.id === pair.endFieldId))) {
      throw new Error('模型关系引用了不存在的表或字段');
    }
  }
  const transform = data.transform;
  const validView = transform && Number.isFinite(transform.pan?.x) &&
    Number.isFinite(transform.pan?.y) && Number.isFinite(transform.zoom) &&
    transform.zoom >= 0.01 && transform.zoom <= 10;
  return {
    diagramId: crypto.randomUUID(), name: `${data.title || filename.replace(/\.(json|ddb)$/i, '')} · ${tr('导入副本')}`,
    database: data.database || 'generic', tables: data.tables, references: data.relationships,
    notes: data.notes, areas: data.subjectAreas, views: data.views || [],
    types: data.types || [], enums: data.enums || [], reviewGroups: modelGroups(data.reviewGroups, data.tables),
    pan: validView ? transform.pan : { x: 1305, y: 961.5 }, zoom: validView ? transform.zoom : 0.4,
    gistId: '', loadedFromGistId: '', lastModified: new Date(),
  };
}

export function exportModel(snapshot) {
  return JSON.stringify(versionModelDocument({
    title: snapshot.name, database: snapshot.database, tables: snapshot.tables,
    reviewGroups: modelGroups(snapshot.reviewGroups, snapshot.tables),
    relationships: snapshot.references, notes: snapshot.notes, subjectAreas: snapshot.areas,
    views: snapshot.views || [], types: snapshot.types || [], enums: snapshot.enums || [],
    transform: { pan: snapshot.pan, zoom: snapshot.zoom },
  }), null, 2);
}
