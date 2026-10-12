import { cleanLocation, normalizeReadingState, restoreLocation, scopeKey, validView } from './reading-state.mjs';

export { cleanReadingLayout, contextLayout, CONTEXT_VIEWS } from './reading-layout.mjs';
import { cleanReadingLayout } from './reading-layout.mjs';
export const workspaceStorageKey = id => `erwiki.workspaces.v1.${encodeURIComponent(id)}`;
export function cleanWorkspaceSnapshot(value = {}) {
  value = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { location: cleanLocation(value.location), view: validView(value.view) ? value.view : null,
    layout: cleanReadingLayout(value.layout),
    collapsedDomains: normalizeReadingState({ collapsedDomains: value.collapsedDomains }).collapsedDomains,
    queryId: typeof value.queryId === 'string' ? value.queryId.slice(0, 120) : '' };
}
export function cleanReadingWorkspaces(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).filter(w => w && typeof w.id === 'string' && w.id.length > 0 && w.id.length <= 120 &&
    typeof w.name === 'string' && w.name.trim() && w.name.length <= 120 && !seen.has(w.id) && seen.add(w.id))
    .slice(-30).map(w => ({ id: w.id, name: w.name.trim(), snapshot: cleanWorkspaceSnapshot(w.snapshot) }));
}
export function loadReadingWorkspaces(storage, id) {
  try { return cleanReadingWorkspaces(JSON.parse(storage.getItem(workspaceStorageKey(id)) || '[]')); } catch { return []; }
}
export function saveReadingWorkspaces(storage, id, workspaces) { storage.setItem(workspaceStorageKey(id), JSON.stringify(cleanReadingWorkspaces(workspaces))); }
export function restoreWorkspaceState(state, snapshot, model) {
  const entry = cleanWorkspaceSnapshot(snapshot), location = restoreLocation(entry.location, model);
  return { ...normalizeReadingState(state), location,
    views: entry.view ? { ...state.views, [scopeKey(location)]: entry.view } : state.views,
    layout: entry.layout, collapsedDomains: entry.collapsedDomains,
    queryId: model.reviewQueries?.some(q => q.id === entry.queryId) || entry.queryId.startsWith('builtin:') ? entry.queryId : '' };
}
