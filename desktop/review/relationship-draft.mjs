import { pairsOf, fieldDefinition } from "./model-checks.mjs";
export function relationshipDraft(data = {}) {
  return {
    startTableId: data.startTableId ?? "",
    endTableId: data.endTableId ?? "",
    fields: pairsOf(data).map((pair) => ({
      startFieldId: pair.startFieldId ?? "",
      endFieldId: pair.endFieldId ?? "",
    })),
  };
}
export function validateRelationshipDraft(
  draft,
  tables,
  relationships = [],
  id,
) {
  const errors = [],
    warnings = [],
    source = tables.find((t) => t.id === draft.startTableId),
    target = tables.find((t) => t.id === draft.endTableId);
  if (!source || !target) return { errors: ["请选择两端的表和字段"], warnings };
  if (!draft.fields.length) errors.push("至少需要一对字段");
  const seen = new Set();
  for (const pair of draft.fields) {
    const a = source.fields.find((f) => f.id === pair.startFieldId),
      b = target.fields.find((f) => f.id === pair.endFieldId);
    if (!a || !b) {
      errors.push("请选择两端的表和字段");
      continue;
    }
    if (source.id === target.id && a.id === b.id)
      errors.push("不能连接字段自身");
    const key = JSON.stringify([a.id, b.id]);
    if (seen.has(key)) errors.push("复合关系中存在重复的字段映射");
    seen.add(key);
    if (fieldDefinition(a) !== fieldDefinition(b))
      warnings.push("关联字段的类型、长度、精度或有符号定义不同，请确认");
  }
  const signature = (value) =>
    JSON.stringify(
      pairsOf(value)
        .map((pair) => JSON.stringify([pair.startFieldId, pair.endFieldId]))
        .sort(),
    );
  if (
    relationships.some(
      (relation) =>
        relation.id !== id &&
        relation.startTableId === draft.startTableId &&
        relation.endTableId === draft.endTableId &&
        signature(relation) === signature(draft),
    )
  )
    errors.push("这组字段的关系已存在");
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
export function endpointPatch(draft) {
  return {
    ...draft,
    fields: draft.fields.map((pair) => ({ ...pair })),
    startFieldId: draft.fields[0].startFieldId,
    endFieldId: draft.fields[0].endFieldId,
  };
}
export function swappedRelationship(data) {
  return {
    ...endpointPatch({
      startTableId: data.endTableId,
      endTableId: data.startTableId,
      fields: pairsOf(data).map((pair) => ({
        startFieldId: pair.endFieldId,
        endFieldId: pair.startFieldId,
      })),
    }),
    cardinality:
      {
        many_to_one: "one_to_many",
        one_to_many: "many_to_one",
        one_to_one: "one_to_one",
      }[data.cardinality] || data.cardinality,
  };
}
