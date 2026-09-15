import { Validator } from 'jsonschema';
import { jsonSchema } from '../../work/drawdb/src/data/schemas.js';
import { DB } from '../../work/drawdb/src/data/constants.js';
import { validateGroups } from '../../work/drawdb/src/utils/tableGroups.js';
import { migrateModelDocument } from '../renderer/model-format.mjs';
import { checkModel } from './model-checks.mjs';
import { issueMessages } from './issue-messages.mjs';
import { resolveRelationSemantics } from './relation-semantics.mjs';

// Extend the pinned renderer's structural schema instead of maintaining a copy.
// Index references legitimately support either field IDs or names.
const schema = structuredClone(jsonSchema);
for (const key of ['indices', 'uniqueConstraints'])
  schema.properties.tables.items.properties[key].items.properties.fields.items.type = ['string', 'integer'];
schema.properties.relationships.items.properties.fields = {
  type: 'array', minItems: 1, items: { type: 'object', required: ['startFieldId', 'endFieldId'],
    properties: { startFieldId: { type: ['string', 'integer'] }, endFieldId: { type: ['string', 'integer'] } } },
};
schema.properties.relationships.items.properties.reviewEvidence = { type: 'object' };
const validator = new Validator();
const diagnostic = (code, path, message) => ({ code, path, message });

export function normalizeModelDocument(input) {
  const model = migrateModelDocument(structuredClone(input)), warnings = [];
  if (Array.isArray(model.relationships)) model.relationships = model.relationships.map((r, index) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return r;
    const next = { ...r };
    if (next.fields === undefined) next.fields = [{ startFieldId: r.startFieldId, endFieldId: r.endFieldId }];
    if (Array.isArray(next.fields) && next.fields[0] && typeof next.fields[0] === 'object') {
      const first = next.fields[0];
      if (next.startFieldId !== first.startFieldId || next.endFieldId !== first.endFieldId) {
        warnings.push(diagnostic('LEGACY_PAIR_NORMALIZED', `relationships[${index}]`, '兼容字段已按第一对复合映射规范化'));
        next.startFieldId = first.startFieldId; next.endFieldId = first.endFieldId;
      }
    }
    if (next.reviewEvidence === undefined) next.reviewEvidence = { kind: 'unspecified' };
    if (next.reviewEvidence && typeof next.reviewEvidence === 'object' && !Array.isArray(next.reviewEvidence)) {
      next.reviewEvidence = { kind: 'unspecified', ...next.reviewEvidence };
      const semantic = resolveRelationSemantics(next);
      if (semantic.conditionState === 'valid') next.reviewEvidence.condition = semantic.condition;
    }
    return next;
  });
  return { model, warnings };
}

function issuePath(issue, model) {
  if (issue.path || issue.params.path) return issue.path || issue.params.path;
  const target = issue.target;
  if (target.relationshipId !== undefined) {
    const index = model.relationships.findIndex(r => r.id === target.relationshipId);
    return `relationships[${index}]` + (target.pairIndex !== undefined ? `.fields[${target.pairIndex}]` : '');
  }
  const index = model.tables.findIndex(t => t.id === target.tableId), table = model.tables[index];
  return `tables[${index}]` + (target.fieldId !== undefined ? `.fields[${table.fields.findIndex(f => f.id === target.fieldId)}]` : '');
}

export function validateModelDocument(input, { typeInfo } = {}) {
  let model, warnings;
  try { ({ model, warnings } = normalizeModelDocument(input)); }
  catch (error) { return { model: null, errors: [diagnostic('MODEL_FORMAT_INVALID', '', error.message)], warnings: [] }; }
  const errors = [];
  const structural = validator.validate(model, schema);
  for (const error of structural.errors)
    errors.push(diagnostic('MODEL_SCHEMA_INVALID', error.property.replace(/^instance\.?/, ''), error.message));
  if (!Object.values(DB).includes(model.database || 'generic')) errors.push(diagnostic('DATABASE_INVALID', 'database', '数据库类型无效'));
  if (errors.length) return { model, errors, warnings };
  try { validateGroups(model.reviewGroups, model.tables); }
  catch (error) { errors.push(diagnostic('GROUPS_INVALID', 'reviewGroups', error.message)); }
  // A headless caller must provide the same dialect catalogue as the renderer;
  // failing explicitly is preferable to silently skipping length/precision.
  if (typeof typeInfo !== 'function') errors.push(diagnostic('TYPE_CATALOGUE_REQUIRED', 'database', '模型校验需要数据库类型目录'));
  for (const issue of checkModel(model, { typeInfo: typeInfo || (() => ({})) })) {
    const item = diagnostic(issue.code, issuePath(issue, model), issueMessages[issue.code] || issue.code);
    (issue.severity === 'error' ? errors : warnings).push(item);
  }
  return { model, errors, warnings };
}

export function requireValidModelDocument(input, options) {
  const result = validateModelDocument(input, options);
  if (result.errors.length) throw Object.assign(new Error(result.errors[0].message), { code: 'MODEL_VALIDATION_FAILED', errors: result.errors, warnings: result.warnings });
  return result;
}
