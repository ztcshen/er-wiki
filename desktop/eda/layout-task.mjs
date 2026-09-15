import { candidateValidity, compareCandidates } from './layout-quality.mjs';
// One request owns one worker and deadline. Cancellation never writes a model.
export function createLayoutTask(
  createWorker,
  model,
  options,
  { id = 1, timeoutMs = 25000, onProgress = () => {} } = {},
) {
  let worker,
    timer,
    finished = false,
    rejectTask, best = null;
  const dispose = () => {
    clearTimeout(timer);
    worker?.terminate();
  };
  const promise = new Promise((resolve, reject) => {
    rejectTask = reject;
    const finish = (result, error) => {
      if (finished) return;
      finished = true;
      dispose();
      error ? reject(error) : resolve(result);
    };
    try {
      worker = createWorker();
      timer = setTimeout(
        () =>
          best ? finish({ ...best, diagnostics: { ...best.diagnostics, stopReason: 'timeout', optimizationComplete: false } })
            : finish(null, new Error("布局超时，请缩小领域或重试。原模型未改变。")),
        timeoutMs,
      );
      worker.onmessage = ({ data }) => {
        if (finished || data.id !== id) return;
        if (data.type === 'progress') {
          if (candidateValidity(data.result).valid && (!best || compareCandidates(data.result, best) < 0)) {
            best = data.result; onProgress(best);
          }
          return;
        }
        if (data.type && data.type !== 'final') return;
        if (data.type === 'final' && !data.error && best && (!candidateValidity(data.result).valid || compareCandidates(best, data.result) < 0)) {
          finish({ ...best, diagnostics: { ...data.result?.diagnostics, stopReason: 'best-validated-candidate' } }); return;
        }
        if (data.error && best) finish({ ...best, diagnostics: { ...best.diagnostics, stopReason: 'engine-error', message: data.error, optimizationComplete: false } });
        else finish(data.result, data.error ? new Error(data.error) : null);
      };
      worker.onerror = (event) => best
        ? finish({ ...best, diagnostics: { ...best.diagnostics, stopReason: 'engine-error', optimizationComplete: false } })
        : finish(null, new Error(event.message || "布局引擎未能启动"));
      worker.postMessage({ id, model, options: { ...options, softBudgetMs: Math.min(options?.softBudgetMs ?? 23000, Math.max(0, timeoutMs - 500)) } });
    } catch (error) {
      finish(null, error);
    }
  });
  return {
    promise,
    cancel() {
      if (finished) return;
      finished = true;
      dispose();
      rejectTask(
        Object.assign(new Error("已取消布局，原模型未改变。"), {
          code: "LAYOUT_CANCELLED",
        }),
      );
    },
  };
}
