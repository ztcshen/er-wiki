import { pairsOf } from '../review/model-checks.mjs';

export function fieldRelationshipIds(relationships, tableId, fieldId) {
  if (tableId == null || fieldId == null) return [];
  return relationships.filter(relation => pairsOf(relation).some(pair =>
    (relation.startTableId === tableId && pair.startFieldId === fieldId) ||
    (relation.endTableId === tableId && pair.endFieldId === fieldId))).map(relation => relation.id);
}

// A field is narrower than a table; an explicit net retains its own member set.
// null delegates to the selected net, while [] means an isolated focused object.
export function focusRelationshipIds(relationships, { selectedTable, selectedField, selectedNet }) {
  if (selectedField != null) return fieldRelationshipIds(relationships, selectedTable, selectedField);
  if (selectedNet != null || selectedTable == null) return null;
  return relationships.filter(r => r.startTableId === selectedTable || r.endTableId === selectedTable).map(r => r.id);
}
