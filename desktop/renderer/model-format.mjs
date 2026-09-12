import { validateProcessModel } from '../process/definition.mjs';
export const MODEL_VERSION = 2;

// Version 0 is the original drawDB JSON. Migration never rewrites field content.
export function migrateModelDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid model document');
  const version = value.schemaVersion ?? 0;
  if (!Number.isInteger(version) || version < 0 || version > MODEL_VERSION)
    throw new Error('This model requires a newer ER Wiki version');
  if (value.format && value.format !== 'er-wiki') throw new Error('Unsupported model format');
  validateProcessModel(value.processModel);
  return { ...value, format: 'er-wiki', schemaVersion: MODEL_VERSION,
    notes: value.notes ?? [], subjectAreas: value.subjectAreas ?? [] };
}

export function versionModelDocument(value) {
  return migrateModelDocument({ ...value, format: 'er-wiki', schemaVersion: MODEL_VERSION });
}
