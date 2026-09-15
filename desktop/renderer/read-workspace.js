import { exportModel } from './model-file';
import { assertReadableDraft, modelContentHash } from './model-content.mjs';

export async function readWorkspace(current, targetId) {
  assertReadableDraft(document);
  const state = current.current;
  if (!state.ready) throw Object.assign(new Error('Workspace is not ready'), { code: 'WORKSPACE_UNAVAILABLE' });
  const modelId = state.snapshot.diagramId;
  if (!modelId || targetId != null && targetId !== modelId) throw Object.assign(new Error('Read target does not match the current model'), { code: 'TARGET_MISMATCH' });
  const json = exportModel(state.snapshot), hasUnsavedChanges = state.isDirty();
  if (new TextEncoder().encode(json).length > 20 * 1024 * 1024) throw Object.assign(new Error('Model exceeds 20 MB'), { code: 'MODEL_FILE_TOO_LARGE' });
  const contentHash = await modelContentHash(JSON.parse(json));
  if (current.current.snapshot.diagramId !== modelId) throw Object.assign(new Error('Model changed while reading'), { code: 'TARGET_MISMATCH' });
  return { modelId, json, contentHash, hasUnsavedChanges, draftStatus: 'none' };
}
