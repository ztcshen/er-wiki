import { pairsOf } from '../review/model-checks.mjs';

export function fieldRelationshipIds(relationships, tableId, fieldId) {
  if (tableId == null || fieldId == null) return [];
  return relationships.filter(relation => pairsOf(relation).some(pair =>
    (relation.startTableId === tableId && pair.startFieldId === fieldId) ||
    (relation.endTableId === tableId && pair.endFieldId === fieldId))).map(relation => relation.id);
}
