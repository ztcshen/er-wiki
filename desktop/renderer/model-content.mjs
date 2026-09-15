const keys = ['format', 'schemaVersion', 'title', 'database', 'tables', 'relationships', 'reviewGroups', 'notes', 'subjectAreas', 'views', 'types', 'enums', 'processModel'];
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}
export function canonicalModelContent(document) {
  return JSON.stringify(canonical(Object.fromEntries(keys.filter(key => document[key] !== undefined).map(key => [key, document[key]]))));
}
export async function modelContentHash(document) {
  const bytes = new TextEncoder().encode(canonicalModelContent(document));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// Reading must never trigger onBlur commits. Be conservative around open editors
// whose local drafts have not necessarily reached the shared model yet.
export function assertReadableDraft(document) {
  const active = document.activeElement;
  if (document.querySelector('[data-editor-draft-invalid="true"], .canvas-editor-dialog, .relationship-endpoint-editor') ||
      (active?.matches?.('input, textarea, [contenteditable="true"]') && !active.closest('.eda-directory')))
    throw Object.assign(new Error('An editor may contain an unapplied draft. Finish or cancel editing before Agent access.'), { code: 'EDITOR_DRAFT_ACTIVE' });
}
