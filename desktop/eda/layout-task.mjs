// One request owns one worker and deadline. Cancellation never writes a model.
export function createLayoutTask(
  createWorker,
  model,
  options,
  { id = 1, timeoutMs = 25000 } = {},
) {
  let worker,
    timer,
    finished = false,
    rejectTask;
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
          finish(null, new Error("布局超时，请缩小领域或重试。原模型未改变。")),
        timeoutMs,
      );
      worker.onmessage = ({ data }) => {
        if (data.id !== id) return;
        finish(data.result, data.error ? new Error(data.error) : null);
      };
      worker.onerror = (event) =>
        finish(null, new Error(event.message || "布局引擎未能启动"));
      worker.postMessage({ id, model, options });
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
