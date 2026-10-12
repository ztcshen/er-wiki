import { useEffect, useRef } from 'react';
import { createReadingPersistence } from './reading-persistence.mjs';
import { saveReadingState } from './reading-state.mjs';

export function useReadingPersistence(modelId, reading, ready, camera) {
  const owner = useRef(null), latest = useRef(null);
  latest.current = { reading, ready, camera };
  useEffect(() => {
    const service = createReadingPersistence({ write: state => {
      try { saveReadingState(localStorage, modelId, state); latest.current.reading.setError(''); }
      catch { latest.current.reading.setError('阅读状态无法写入本机存储；模型内容未受影响。'); }
    } }); owner.current = service;
    const flush = () => { latest.current.camera.flush(); service.update(latest.current.reading.getState(), latest.current.ready); service.flush(); };
    window.addEventListener('pagehide', flush); window.addEventListener('beforeunload', flush);
    return () => { window.removeEventListener('pagehide', flush); window.removeEventListener('beforeunload', flush); flush(); service.dispose(); owner.current = null; };
  }, [modelId]);
  useEffect(() => { owner.current?.update(reading.state, ready); }, [reading.state, ready, modelId]);
}
