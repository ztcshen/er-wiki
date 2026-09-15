import { modelGroups } from '@drawdb/utils/tableGroups';
import { resolveType } from '@drawdb/utils/customTypes';
import { requireValidModelDocument, normalizeModelDocument } from '../review/model-contract.mjs';
import { tr } from '../i18n/renderer';

export function importModel(json, filename) {
  const input = JSON.parse(json);
  const { model: data } = requireValidModelDocument(input, { typeInfo: type => resolveType(input.database || 'generic', type) });
  const transform = data.transform;
  const validView = transform && Number.isFinite(transform.pan?.x) &&
    Number.isFinite(transform.pan?.y) && Number.isFinite(transform.zoom) &&
    transform.zoom >= 0.01 && transform.zoom <= 10;
  return {
    diagramId: crypto.randomUUID(), name: `${data.title || filename.replace(/\.(json|ddb)$/i, '')} · ${tr('导入副本')}`,
    database: data.database || 'generic', tables: data.tables, references: data.relationships,
    notes: data.notes, areas: data.subjectAreas, views: data.views || [],
    types: data.types || [], enums: data.enums || [], reviewGroups: modelGroups(data.reviewGroups, data.tables),
    processModel: data.processModel ?? null,
    pan: validView ? transform.pan : { x: 1305, y: 961.5 }, zoom: validView ? transform.zoom : 0.4,
    gistId: '', loadedFromGistId: '', lastModified: new Date(),
  };
}

export function exportModel(snapshot) {
  return JSON.stringify(normalizeModelDocument({
    title: snapshot.name, database: snapshot.database, tables: snapshot.tables,
    reviewGroups: modelGroups(snapshot.reviewGroups, snapshot.tables),
    relationships: snapshot.references, notes: snapshot.notes, subjectAreas: snapshot.areas,
    views: snapshot.views || [], types: snapshot.types || [], enums: snapshot.enums || [],
    processModel: snapshot.processModel ?? null,
    transform: { pan: snapshot.pan, zoom: snapshot.zoom },
  }).model, null, 2);
}
