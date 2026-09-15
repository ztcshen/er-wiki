const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { readModelFile } = require("../files.cjs");

function replacementArgs(argv, cwd) {
  if (!argv.some(value => value === '--replace-model' || value.startsWith('--replace-model='))) return null;
  const get = (key) => {
    const matches = argv.map((value,index)=>({value,index})).filter(({value})=>value === key || value.startsWith(key+'='));
    if (matches.length !== 1)
      throw new Error("Expected exactly one " + key);
    const match=matches[0];
    const value = match.value === key ? argv[match.index + 1] : match.value.slice(key.length+1);
    if (!value || value.startsWith("--")) throw new Error("Missing " + key);
    return value;
  };
  const targetId = get("--model-id");
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(targetId))
    throw new Error("Invalid model ID");
  return { targetId, file: path.resolve(cwd, get("--replace-model")) };
}

function createModelHandoff({ request, writeResult, timeoutMs = 120000 }) {
  let readyId = null,
    pending = null,
    running = false, sequence = 0, writes = Promise.resolve();
  const publish = (job, status, detail = {}) => {
    const value = { requestId: job.requestId, operation: 'replace-model', targetId: job.targetId ?? null,
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
      if (readyId !== job.targetId)
        throw Object.assign(new Error("Replacement target does not match the open model"), { code: 'TARGET_MISMATCH' });
      const result = await request({
        action: "replace-json",
        requestId: job.requestId,
        targetId: job.targetId,
        json: job.json,
      });
      const detail = typeof result === 'object' && result ? result : { ok: result === true };
      if (detail.ok === true) await publish(job, 'succeeded', { errors: [], warnings: detail.warnings || [] });
      else await failure(job, { code: detail.errorCode, message: detail.message || detail.error || 'Model replacement failed',
        errors: detail.errors, warnings: detail.warnings }, 'REPLACEMENT_FAILED');
    } catch (error) {
      await failure(job, error, 'REPLACEMENT_FAILED');
    } finally {
      running = false;
    }
  };
  return {
    ready(modelId) {
      readyId = modelId;
      void drain().catch((error) =>
        console.error("Replacement result write failed:", error.message),
      );
    },
    async enqueue(argv, cwd) {
      if (!argv.some(value => value === '--replace-model' || value.startsWith('--replace-model='))) return false;
      const job = { requestId: randomUUID(), sequence: ++sequence, startedAt: new Date().toISOString() };
      let args;
      try { args = replacementArgs(argv, cwd); job.targetId = args.targetId; }
      catch (error) { await failure(job, error, 'ARGUMENTS_INVALID'); throw error; }
      if (pending || running) {
        const error = Object.assign(new Error("A model replacement is already in progress"), { code: 'WORKSPACE_BUSY' });
        await failure(job, error, error.code); throw error;
      }
      // Occupy the slot while reading; no arbitrary command/code comes from JSON.
      running = true;
      try {
        await publish(job, 'pending');
        const json = await readModelFile(args.file);
        const sha256 = createHash("sha256").update(json).digest("hex");
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
