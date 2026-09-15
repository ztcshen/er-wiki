// Declarative review metadata only: never execute predicates as SQL or JS.
import { resolveRelationSemantics } from '../review/relation-semantics.mjs';
export function relationCondition(relation, sourceTable) {
  const semantic = resolveRelationSemantics(relation, sourceTable);
  if (semantic.conditionState === 'absent') return null;
  return semantic.conditionState === 'valid' ? semantic.condition : { invalid: true };
}

export function conditionText(relation, sourceTable) {
  const condition = relationCondition(relation, sourceTable);
  return condition?.invalid ? '条件无效' : condition ? `${condition.field} = ${condition.value}` : '';
}

export function conditionLabel(relation, sourceTable) {
  const text = conditionText(relation, sourceTable);
  return text ? { text, width: text === '条件无效' ? 180 : Math.min(360, Math.max(100, [...text].length * 7 + 20)), height: 24 } : null;
}
