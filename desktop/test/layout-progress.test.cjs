const { test } = require('node:test');
const assert = require('node:assert/strict');
const candidate = () => ({ projection: { nodes: [], edges: [], nets: [], domains: [] }, layout: { children: [], edges: [] },
  metrics: { crossings: 0, overlaps: 0, length: 0, bends: 0, collinearConflicts: 0, illegalContacts: 0 },
  quality: { nodeIntrusions: 0, labelOverlaps: 0, badgeOverlaps: 0, annotationIntrusions: 0 }, status: 'ready' });
const worker = () => ({ postMessage(value) { this.sent = value; }, terminate() { this.stopped = true; } });

test('progress never resolves the task early; timeout selects only this request valid candidate', async () => {
  const { createLayoutTask } = await import('../eda/layout-task.mjs');
  const w = worker(), seen = [], task = createLayoutTask(() => w, {}, {}, { id: 8, timeoutMs: 15, onProgress: value => seen.push(value) });
  let settled = false; task.promise.then(() => { settled = true; });
  w.onmessage({ data: { id: 7, type: 'progress', result: candidate() } });
  assert.equal(seen.length, 0);
  w.onmessage({ data: { id: 8, type: 'progress', result: candidate() } });
  await Promise.resolve(); assert.equal(settled, false); assert.equal(w.stopped, undefined);
  const result = await task.promise;
  assert.equal(result.diagnostics.stopReason, 'timeout'); assert.equal(w.stopped, true);
  w.onmessage({ data: { id: 8, type: 'progress', result: candidate() } });
  assert.equal(seen.length, 1);
});

test('cancel is not timeout fallback and invalid progress is never usable', async () => {
  const { createLayoutTask } = await import('../eda/layout-task.mjs');
  const w = worker(), task = createLayoutTask(() => w, {}, {}, { timeoutMs: 100 });
  w.onmessage({ data: { id: 1, type: 'progress', result: candidate() } });
  const rejected = assert.rejects(task.promise, error => error.code === 'LAYOUT_CANCELLED');
  task.cancel(); await rejected;
  const invalidWorker = worker(), invalid = createLayoutTask(() => invalidWorker, {}, {}, { timeoutMs: 5 });
  const bad = candidate(); bad.quality.badgeOverlaps = 1;
  invalidWorker.onmessage({ data: { id: 1, type: 'progress', result: bad } });
  await assert.rejects(invalid.promise, /超时/);
});

test('engine failure after progress retains the validated candidate', async () => {
  const { createLayoutTask } = await import('../eda/layout-task.mjs');
  const w = worker(), task = createLayoutTask(() => w, {}, {});
  w.onmessage({ data: { id: 1, type: 'progress', result: candidate() } });
  w.onmessage({ data: { id: 1, type: 'final', error: 'synthetic failure' } });
  assert.equal((await task.promise).diagnostics.stopReason, 'engine-error');
});
