import { createModelIndexEngine } from './model-index.mjs';
const cancelled = () => Object.assign(new Error('已取消索引更新'), { code: 'INDEX_CANCELLED' });

// One workspace owns one reusable worker. Requests own their callbacks; disposing
// the owner rejects requests, removes listeners and terminates only that worker.
export function createModelIndexService({ createWorker, timeoutMs = 20000, engine = createModelIndexEngine() } = {}) {
  let worker, unavailable = !createWorker, disposed = false, sequence = 0, pending = null;
  const settle = (job, index, error) => { if (pending !== job) return; clearTimeout(job.timer); pending = null; error ? job.reject(error) : job.resolve(index); };
  const stopWorker = () => { if (!worker) return; worker.onmessage = worker.onerror = null; worker.terminate(); worker = null; unavailable = true; };
  const cancelPending = () => {
    if (!pending) return;
    const job = pending; job.stopped = true;
    try { worker?.postMessage({ type: 'cancel', id: job.id }); } catch { stopWorker(); }
    settle(job, null, cancelled());
  };
  return {
    request(model, onPhase = () => {}) {
      cancelPending(); const job = { id: ++sequence, stopped: false, onPhase };
      const promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; pending = job;
        if (disposed) { settle(job, null, cancelled()); return; }
        if (!worker && !unavailable) try { worker = createWorker();
          worker.onmessage = ({ data }) => { if (disposed || pending?.id !== data.id) return;
            if (data.type === 'phase') pending.onPhase(data.phase);
            else if (data.type === 'ready') settle(pending, data.index);
            else if (data.type === 'error') settle(pending, null, new Error(data.error)); };
          worker.onerror = event => { const failed = pending; stopWorker(); if (failed) settle(failed, null, new Error(event.message || '索引引擎未能启动')); };
        } catch { unavailable = true; }
        if (worker) {
          job.timer = setTimeout(() => { if (pending !== job) return; job.stopped = true; stopWorker(); settle(job, null, new Error('索引更新超时，请重试')); }, timeoutMs);
          try { worker.postMessage({ type: 'index', id: job.id, model }); }
          catch (error) { stopWorker(); settle(job, null, error); }
        }
        else engine.build(model, { current: () => !disposed && pending === job && !job.stopped, onPhase }).then(index => settle(job, index)).catch(error => settle(job, null, error));
      });
      return { promise, cancel() { if (pending === job) cancelPending(); } };
    },
    dispose() { if (disposed) return; disposed = true; cancelPending(); stopWorker(); engine.clear(); },
  };
}
