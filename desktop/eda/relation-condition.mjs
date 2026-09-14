// Declarative review metadata only: never execute predicates as SQL or JS.
export function relationCondition(relation) {
  const condition = relation?.reviewEvidence?.condition;
  if (!condition || typeof condition.field !== 'string' || typeof condition.value !== 'string') return null;
  if (!condition.field.trim() || !condition.value.trim()) return null;
  return { field: condition.field, value: condition.value };
}

export function conditionText(relation) {
  const condition = relationCondition(relation);
  return condition ? `${condition.field} = ${condition.value}` : '';
}

export function conditionLabel(relation) {
  const text = conditionText(relation);
  return text ? { text, width: Math.min(360, Math.max(100, [...text].length * 7 + 20)), height: 24 } : null;
}
