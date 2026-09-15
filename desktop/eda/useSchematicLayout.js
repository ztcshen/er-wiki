import { useEffect, useMemo, useRef, useState } from "react";
import { geometryKey, refreshLayoutContent } from "./layout-content.mjs";
import { createLayoutTask } from "./layout-task.mjs";
import { scopeKey } from "./reading-state.mjs";
import { desktopLayoutCache } from "./layout-cache.mjs";
import { createCachedLayoutTask } from "./cached-layout-task.mjs";
import { readingToken, deferImprovement } from './layout-presentation.mjs';
import { layoutObserver, modelGeometryIdentity } from './layout-observation.mjs';

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
  const [improvement, setImprovement] = useState(null);
  const latest = useRef(null);
  const userIntent = useRef(0);
  useEffect(() => {
    const record = event => { if (event.isTrusted) userIntent.current++; };
    for (const type of ['pointerdown', 'wheel', 'keydown']) document.addEventListener(type, record, true);
    return () => { for (const type of ['pointerdown', 'wheel', 'keydown']) document.removeEventListener(type, record, true); };
  }, []);
  latest.current = { view: reading.view, location };
  const job = useRef(null),
    sequence = useRef(0), forceNext = useRef(null);
  const key = JSON.stringify([modelId, shape, viewKey, revision]);
  const result = useMemo(() => refreshLayoutContent(raw, model), [raw, model]);
  useEffect(() => {
    let obsolete = false;
    modelGeometryIdentity(model).then(layoutIdentity => {
      if (obsolete) return;
      layoutObserver.report({ modelId, layoutIdentity,
        layoutStatus: location.level !== 'overview' ? 'pending' : error ? 'failed' : completed === key && raw ? (raw.status === 'degraded' ? 'degraded' : 'ready') : 'pending',
        layoutMessage: error || raw?.validity?.reasons?.join(', ') || null });
    }).catch(() => {});
    return () => { obsolete = true; };
  }, [modelId, model, raw, completed, key, error]);
  useEffect(() => {
    if (!ready || !input.model.tables.length) {
      setRaw(null);
      setBusy(false);
      return;
    }
    const id = ++sequence.current;
    let preview = null, previewToken = null, previewSelection = null, previewIntent = 0;
    setImprovement(null);
    const firstView = value => {
      if (!rememberedView) {
        const view = [0, 0, Math.max(300, value.layout.width || 800), Math.max(250, value.layout.height || 500)];
        latest.current = { ...latest.current, view }; setView(view);
      }
    };
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
        { id, onProgress: value => {
          if (sequence.current !== id || preview) return;
          preview = value;
          firstView(value);
          previewToken = readingToken(latest.current.view, latest.current.location);
          previewSelection = readingToken(null, latest.current.location);
          previewIntent = userIntent.current;
          setRaw(value); setCompleted(key);
        } },
      ),
    });
    job.current = task;
    task.promise
        .then((value) => {
          if (sequence.current !== id) return;
          const interacted = userIntent.current !== previewIntent || readingToken(null, latest.current.location) !== previewSelection;
          if (deferImprovement(preview, value, previewToken, readingToken(latest.current.view, latest.current.location), interacted))
            setImprovement({ value, key, id });
          else setRaw(value);
          setCompleted(key);
          setBusy(false);
          if (!preview || !interacted) firstView(value);
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
    setImprovement(null);
    setError("已取消布局，原模型未改变。");
  };
  return {
    result,
    current: ready && completed === key,
    busy,
    error,
    cancel,
    hasImprovement: improvement?.key === key && improvement?.id === sequence.current,
    applyImprovement: () => {
      if (improvement?.key !== key || improvement?.id !== sequence.current) return;
      setRaw(improvement.value); setImprovement(null);
    },
    arrange: () => { forceNext.current = JSON.stringify([modelId, viewKey]); setRevision((n) => n + 1); },
  };
}
