import { geometryKey } from './layout-content.mjs';
import { layoutDigest } from './layout-cache.mjs';

export function modelGeometryIdentity(model) {
  return layoutDigest(geometryKey({ tables: model.tables, relationships: model.relationships || model.references || [], groups: model.groups || model.reviewGroups || [] }, { level: 'overview' }));
}
export function createLayoutObserver(send = () => {}) {
  let tracked = null;
  return {
    begin(requestId, modelId, layoutIdentity) { tracked = { requestId, modelId, layoutIdentity, layoutStatus: 'pending' }; },
    report(state) {
      if (!tracked || tracked.layoutStatus !== 'pending' || state.modelId !== tracked.modelId || state.layoutIdentity !== tracked.layoutIdentity) return false;
      tracked = { ...tracked, layoutStatus: state.layoutStatus, layoutMessage: state.layoutMessage || null };
      send(tracked); return true;
    },
    current(requestId) { return tracked?.requestId === requestId ? { ...tracked } : null; },
  };
}
export const layoutObserver = createLayoutObserver(state => globalThis.window?.erDesktop?.layoutStatus(state));
