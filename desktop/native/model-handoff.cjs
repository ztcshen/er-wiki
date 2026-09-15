const { createHash, randomUUID } = require("node:crypto");
const { readModelFile, atomicWrite } = require("../files.cjs");
const { replacementArgs, modelCommandArgs } = require('./model-command-args.cjs');

function createModelHandoff({ request, writeResult, timeoutMs = 120000 }) {
  let readyId = null,
    pending = null,
    running = false, sequence = 0, writes = Promise.resolve(), activeRequestId = null, latestLayout = null, lastSuccess = null;
  const publish = (job, status, detail = {}) => {
    const value = { requestId: job.requestId, operation: job.operation || 'replace-model', targetId: job.targetId ?? null,
      sha256: job.sha256 ?? null, status, ok: status === 'pending' ? null : status === 'succeeded',
      layoutStatus: 'not_observed', startedAt: job.startedAt,
      ...(status === 'pending' ? {} : { finishedAt: new Date().toISOString() }), ...detail };
    // A slow older operation must not overwrite a newer request's failure receipt.
    const write = writes.catch(() => {}).then(() => job.sequence === sequence ? writeResult(value) : undefined);
    writes = write;
    return write;
  };
  const failure = (job, error, fallback) => publish(job, 'failed', {
    errorCode: error.code || fallback, message: error.message, error: error.message,
    errors: error.errors || [], warnings: error.warnings || [],
  });
  const drain = async () => {
    if (!pending || !readyId || running) return;
    const job = pending;
    pending = null;
    running = true;
    clearTimeout(job.timer);
    try {
      if (job.targetId != null && readyId !== job.targetId)
        throw Object.assign(new Error("Replacement target does not match the open model"), { code: 'TARGET_MISMATCH' });
      const result = await request({
        action: job.operation === 'replace-model' ? "replace-json" : 'read-current',
        requestId: job.requestId,
        targetId: job.targetId,
        json: job.json,
        expectedContentHash: job.expectedContentHash,
      });
      const detail = typeof result === 'object' && result ? result : { ok: result === true };
      if (detail.ok === true) {
        const output = {};
        if (job.operation === 'replace-model' && detail.layoutIdentity) {
          Object.assign(output, { layoutIdentity: detail.layoutIdentity, layoutStatus: detail.layoutStatus || 'pending' });
          if (latestLayout?.requestId === job.requestId && latestLayout.modelId === job.targetId && latestLayout.layoutIdentity === detail.layoutIdentity)
            Object.assign(output, { layoutStatus: latestLayout.layoutStatus, layoutMessage: latestLayout.layoutMessage });
        }
        if (job.operation !== 'replace-model') {
          if (detail.modelId !== readyId || typeof detail.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(detail.contentHash)) throw Object.assign(new Error('Invalid current-model response'), { code: 'MODEL_RESPONSE_INVALID' });
          if (typeof detail.json !== 'string' || Buffer.byteLength(detail.json) > 20 * 1024 * 1024) throw Object.assign(new Error('Invalid or oversized model export'), { code: 'MODEL_FILE_TOO_LARGE' });
          Object.assign(output, { targetId: detail.modelId, contentHash: detail.contentHash, hasUnsavedChanges: detail.hasUnsavedChanges, draftStatus: detail.draftStatus });
          if (job.operation === 'export-model') {
            await atomicWrite(job.file, detail.json, { overwrite: job.overwrite === true });
            output.sha256 = createHash('sha256').update(detail.json).digest('hex');
          }
        }
        const success = { errors: [], warnings: detail.warnings || [], ...output };
        lastSuccess = { job, detail: success };
        await publish(job, 'succeeded', success);
      }
      else await failure(job, { code: detail.errorCode, message: detail.message || detail.error || 'Model replacement failed',
        errors: detail.errors, warnings: detail.warnings }, 'REPLACEMENT_FAILED');
    } catch (error) {
      await failure(job, error, 'REPLACEMENT_FAILED');
    } finally {
      running = false;
    }
  };
  return {
    layoutStatus(state) {
      if (state.requestId !== activeRequestId) return;
      latestLayout = state;
      if (!lastSuccess || lastSuccess.job.requestId !== state.requestId || lastSuccess.job.targetId !== state.modelId || lastSuccess.detail.layoutIdentity !== state.layoutIdentity) return;
      if (lastSuccess.detail.layoutStatus !== 'pending') return;
      lastSuccess.detail = { ...lastSuccess.detail, layoutStatus: state.layoutStatus, layoutMessage: state.layoutMessage };
      void publish(lastSuccess.job, 'succeeded', lastSuccess.detail).catch(error => console.error('Layout receipt write failed:', error.message));
    },
    ready(modelId) {
      readyId = modelId;
      void drain().catch((error) =>
        console.error("Replacement result write failed:", error.message),
      );
    },
    async enqueue(argv, cwd) {
      if (!argv.some(value => ['--replace-model', '--export-model', '--inspect-model'].some(key => value === key || value.startsWith(key + '=')))) return false;
      const job = { requestId: randomUUID(), sequence: ++sequence, startedAt: new Date().toISOString() };
      activeRequestId = job.requestId; latestLayout = null; lastSuccess = null;
      let args;
      try { args = modelCommandArgs(argv, cwd); job.targetId = args.targetId; job.operation = args.operation; }
      catch (error) { await failure(job, error, 'ARGUMENTS_INVALID'); throw error; }
      if (pending || running) {
        const error = Object.assign(new Error("A model replacement is already in progress"), { code: 'WORKSPACE_BUSY' });
        await failure(job, error, error.code); throw error;
      }
      // Occupy the slot while reading; no arbitrary command/code comes from JSON.
      running = true;
      try {
        await publish(job, 'pending');
        const json = args.operation === 'replace-model' ? await readModelFile(args.file) : undefined;
        const sha256 = json === undefined ? null : createHash("sha256").update(json).digest("hex");
        job.sha256 = sha256;
        await publish(job, 'pending');
        pending = {
          ...job,
          ...args,
          json,
          sha256,
          timer: setTimeout(() => {
            pending = null;
            failure(job, { code: 'WORKSPACE_TIMEOUT', message: 'Workspace was not ready before timeout' }, 'WORKSPACE_TIMEOUT').catch((error) =>
              console.error("Replacement result write failed:", error.message),
            );
          }, timeoutMs),
        };
      } catch (error) {
        await failure(job, error, 'FILE_READ_FAILED');
        throw error;
      } finally {
        running = false;
      }
      void drain().catch((error) =>
        console.error("Replacement result write failed:", error.message),
      );
      return true;
    },
  };
}
module.exports = { replacementArgs, createModelHandoff };
