export const RELATION_KINDS = ['physical', 'logical', 'inferred', 'unspecified'];
export const CARDINALITIES = ['one_to_one', 'one_to_many', 'many_to_one', 'many_to_many'];
export const relationMessages = {
  RELATION_KIND_INVALID: '关系性质无效',
  RELATION_CARDINALITY_INVALID: '关系基数无效',
  RELATION_EVIDENCE_INVALID: '关系依据格式无效',
  PHYSICAL_CONDITION_CONFLICT: '物理外键不能带业务条件',
  CONDITION_INVALID: '条件格式无效',
  CONDITION_FIELD_MISSING: '条件引用了不存在的源表字段',
  CONDITION_VALUE_INVALID: '条件值必须是明确的非空字符串或安全整数',
  CONDITION_ENUM_VALUE: '条件值不在已声明枚举中',
  RELATION_FIELDS_INVALID: '复合关系必须包含有效的字段映射',
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const present = (value, key) => object(value) && Object.hasOwn(value, key);

// Pure interpretation shared by import, checking, editing, drawing and export.
// "Declared physical" is a model assertion, not production verification.
export function resolveRelationSemantics(relation, sourceTable) {
  const evidence = relation?.reviewEvidence, errors = [], warnings = [];
  const report = (code, path, warning = false) => (warning ? warnings : errors).push({ code, path, message: relationMessages[code] });
  if (present(relation, 'reviewEvidence') && !object(evidence)) report('RELATION_EVIDENCE_INVALID', 'reviewEvidence');
  const kind = evidence?.kind === undefined ? 'unspecified' : evidence.kind;
  if (!RELATION_KINDS.includes(kind)) report('RELATION_KIND_INVALID', 'reviewEvidence.kind');
  if (relation?.cardinality != null && !CARDINALITIES.includes(relation.cardinality)) report('RELATION_CARDINALITY_INVALID', 'cardinality');
  if (Object.hasOwn(relation || {}, 'fields') && (!Array.isArray(relation.fields) || !relation.fields.length || relation.fields.some(p => !object(p))))
    report('RELATION_FIELDS_INVALID', 'fields');
  const hasCondition = present(evidence, 'condition');
  let condition = null, conditionState = hasCondition ? 'invalid' : 'absent';
  if (hasCondition) {
    const raw = evidence.condition;
    if (object(raw) && Object.keys(raw).some(key => !['field', 'value'].includes(key))) report('CONDITION_INVALID', 'reviewEvidence.condition');
    if (kind === 'physical') report('PHYSICAL_CONDITION_CONFLICT', 'reviewEvidence.condition');
    if (!object(raw) || typeof raw.field !== 'string' || !raw.field.trim()) {
      report('CONDITION_INVALID', 'reviewEvidence.condition');
    } else {
      const value = Number.isSafeInteger(raw.value) ? String(raw.value) : raw.value;
      if (typeof value !== 'string' || !value.trim()) report('CONDITION_VALUE_INVALID', 'reviewEvidence.condition.value');
      else {
        condition = { field: raw.field, value };
        conditionState = 'valid';
        if (sourceTable) {
          const field = sourceTable.fields?.find(f => f.name === raw.field);
          if (!field) { report('CONDITION_FIELD_MISSING', 'reviewEvidence.condition.field'); conditionState = 'invalid'; }
          else {
            const sqlEnum = String(field.type).toUpperCase() === 'ENUM';
            const values = sqlEnum ? field.values : field.reviewEnumValues?.map(v => v.value);
            if (values?.length && !values.map(String).includes(value)) report('CONDITION_ENUM_VALUE', 'reviewEvidence.condition.value', !sqlEnum);
          }
        }
      }
    }
  }
  if (hasCondition && errors.length) conditionState = 'invalid';
  const type = !RELATION_KINDS.includes(kind) || errors.some(e => e.code === 'RELATION_EVIDENCE_INVALID') ? 'invalid'
    : kind === 'physical' ? 'physical' : ['logical', 'inferred'].includes(kind) ? 'logical' : 'unspecified';
  return { kind, type, certainty: kind === 'inferred' ? 'inferred' : type === 'unspecified' ? 'unknown' : type === 'invalid' ? 'invalid' : 'declared',
    conditionState, condition, errors, warnings, canExportForeignKey: type === 'physical' && !hasCondition && !errors.length };
}

export function relationNatureLabel(relation, sourceTable) {
  const semantic = resolveRelationSemantics(relation, sourceTable);
  if (semantic.errors.length) return '关系定义无效';
  return { physical: '已声明物理外键', logical: '逻辑关联', inferred: '推断关联', unspecified: '性质未声明' }[semantic.kind];
}

export function conditionSignature(relation) {
  const semantic = resolveRelationSemantics(relation);
  return semantic.conditionState === 'absent' ? null : semantic.conditionState === 'valid'
    ? semantic.condition : { invalid: true, condition: relation.reviewEvidence?.condition };
}

export function renameConditionField(relationships, tableId, oldName, newName) {
  if (oldName === newName) return relationships;
  return relationships.map(r => r.startTableId === tableId && r.reviewEvidence?.condition?.field === oldName
    ? { ...r, reviewEvidence: { ...r.reviewEvidence, condition: { ...r.reviewEvidence.condition, field: newName } } } : r);
}
