import { resolveRelationSemantics } from './relation-semantics.mjs';
import { pairsOf } from './model-checks.mjs';

// SQL constraints are opt-in declarations, not every line visible in the ER view.
// Return an independent document: upstream exporters must not mutate the workspace.
export function sqlExportModel(snapshot) {
  const model = structuredClone(snapshot);
  const tables = new Map(model.tables.map(table => [table.id, table]));
  const skippedRelationships = [];
  model.relationships = (model.relationships ?? model.references ?? []).filter(relation => {
    const source = tables.get(relation.startTableId), target = tables.get(relation.endTableId);
    const semantic = resolveRelationSemantics(relation, source);
    const pairs = pairsOf(relation);
    const validEndpoints = source && target && pairs.length && pairs.every(pair =>
      source.fields.some(field => field.id === pair.startFieldId) && target.fields.some(field => field.id === pair.endFieldId));
    if (semantic.canExportForeignKey && validEndpoints) return true;
    skippedRelationships.push({ id: relation.id, name: relation.name,
      reason: !validEndpoints ? 'INVALID_ENDPOINTS' : semantic.errors[0]?.code ??
        (semantic.conditionState !== 'absent' ? 'CONDITIONAL_RELATIONSHIP' : 'NOT_DECLARED_PHYSICAL') });
    return false;
  });
  // The pinned SQL writers consume references, while model files use relationships.
  model.references = model.relationships;
  return { model, skippedRelationships };
}
