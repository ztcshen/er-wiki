import { useEffect, useMemo, useRef, useState } from 'react';
import { modelIndexKey } from './model-index.mjs';
import { createModelIndexService } from './model-index-task.mjs';

export function useModelIndex(model, ready) {
  const key = useMemo(() => modelIndexKey(model), [model.tables, model.relationships]);
  const service = useRef(null), generation = useRef(0);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: '', index: null, phase: null, error: '' });
  useEffect(() => {
    const owner = createModelIndexService({ createWorker: typeof Worker === 'undefined' ? null
      : () => new Worker(new URL('./model-index.worker.js', import.meta.url), { type: 'module' }) });
    service.current = owner; return () => { generation.current++; owner.dispose(); service.current = null; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const id = ++generation.current;
    setState(s => ({ ...s, phase: { phase: 'tables' }, error: '' }));
    const task = service.current.request({ tables: model.tables, relationships: model.relationships }, phase => {
      if (generation.current === id) setState(s => ({ ...s, phase }));
    });
    task.promise.then(index => { if (generation.current === id) setState({ key, index, phase: { phase: 'ready' }, error: '' }); })
      .catch(error => { if (generation.current === id && error.code !== 'INDEX_CANCELLED') setState(s => ({ ...s, error: error.message, phase: null })); });
    return () => { generation.current++; task.cancel(); };
  }, [key, ready, revision]);
  return { ...state, signature: key, retry: () => setRevision(n => n + 1), ready: ready && state.key === key && state.index?.ready === true };
}
