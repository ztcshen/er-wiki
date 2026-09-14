const path = require("node:path");
const { createHash } = require("node:crypto");
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
    running = false;
  const drain = async () => {
    if (!pending || !readyId || running) return;
    const job = pending;
    pending = null;
    running = true;
    clearTimeout(job.timer);
    try {
      if (readyId !== job.targetId)
        throw new Error("Replacement target does not match the open model");
      const ok = await request({
        action: "replace-json",
        targetId: job.targetId,
        json: job.json,
      });
      await writeResult({
        targetId: job.targetId,
        sha256: job.sha256,
        ok,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      await writeResult({
        targetId: job.targetId,
        sha256: job.sha256,
        ok: false,
        error: error.message,
        finishedAt: new Date().toISOString(),
      });
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
      const args = replacementArgs(argv, cwd);
      if (!args) return false;
      if (pending || running)
        throw new Error("A model replacement is already in progress");
      // Occupy the slot while reading; no arbitrary command/code comes from JSON.
      running = true;
      try {
        const json = await readModelFile(args.file);
        const sha256 = createHash("sha256").update(json).digest("hex");
        await writeResult({
          targetId: args.targetId,
          sha256,
          ok: null,
          startedAt: new Date().toISOString(),
        });
        pending = {
          ...args,
          json,
          sha256,
          timer: setTimeout(() => {
            pending = null;
            writeResult({
              targetId: args.targetId,
              sha256,
              ok: false,
              error: "Workspace was not ready before timeout",
              finishedAt: new Date().toISOString(),
            }).catch((error) =>
              console.error("Replacement result write failed:", error.message),
            );
          }, timeoutMs),
        };
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
