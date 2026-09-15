import { useEffect, useMemo, useRef, useState } from "react";
import { geometryKey, refreshLayoutContent } from "./layout-content.mjs";
import { createLayoutTask } from "./layout-task.mjs";
import { scopeKey } from "./reading-state.mjs";
import { desktopLayoutCache } from "./layout-cache.mjs";
import { createCachedLayoutTask } from "./cached-layout-task.mjs";

export function useSchematicLayout(modelId, model, reading, ready) {
  const { location, rememberedView, setView } = reading;
  const viewKey = scopeKey(location);
  const shape = useMemo(() => geometryKey(model, location), [model, viewKey]);
  const [revision, setRevision] = useState(0),
    [raw, setRaw] = useState(null);
  const input = useMemo(() => ({ model, options: location, shape }), [modelId, shape, viewKey, revision]);
  const [completed, setCompleted] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const job = useRef(null),
    sequence = useRef(0), forceNext = useRef(null);
  const key = JSON.stringify([modelId, shape, viewKey, revision]);
  const result = useMemo(() => refreshLayoutContent(raw, model), [raw, model]);
  useEffect(() => {
    if (!ready || !input.model.tables.length) {
      setRaw(null);
      setBusy(false);
      return;
    }
    const id = ++sequence.current;
    const force = forceNext.current === JSON.stringify([modelId, viewKey]);
    forceNext.current = null;
    setBusy(false);
    setError("");
    const task = createCachedLayoutTask({
      modelId, scope: viewKey, ...input, cache: desktopLayoutCache(), force,
      onCompute: () => { if (sequence.current === id) setBusy(true); },
      compute: () => createLayoutTask(
        () =>
          new Worker(new URL("./layout.worker.js", import.meta.url), {
            type: "module",
          }),
        input.model,
        input.options,
        { id },
      ),
    });
    job.current = task;
    task.promise
        .then((value) => {
          if (sequence.current !== id) return;
          setRaw(value);
          setCompleted(key);
          setBusy(false);
          if (!rememberedView)
            setView([
              0,
              0,
              Math.max(300, value.layout.width || 800),
              Math.max(250, value.layout.height || 500),
            ]);
        })
        .catch((failure) => {
          if (sequence.current !== id) return;
          if (failure.code !== "LAYOUT_CANCELLED") setError(failure.message);
          setBusy(false);
        });
    return () => {
      sequence.current++;
      job.current?.cancel();
      job.current = null;
    };
  }, [input, key, ready]);
  const cancel = () => {
    sequence.current++;
    job.current?.cancel();
    job.current = null;
    setBusy(false);
    setError("已取消布局，原模型未改变。");
  };
  return {
    result,
    current: ready && completed === key,
    busy,
    error,
    cancel,
    arrange: () => { forceNext.current = JSON.stringify([modelId, viewKey]); setRevision((n) => n + 1); },
  };
}
