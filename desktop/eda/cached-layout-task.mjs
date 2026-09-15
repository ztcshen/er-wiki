import { layoutDigest } from './layout-cache.mjs';
import { layoutSnapshot, restoreLayoutSnapshot } from './layout-snapshot.mjs';
import { candidateValidity } from './layout-quality.mjs';

const cancelled = () => Object.assign(new Error('Layout cancelled'), { code: 'LAYOUT_CANCELLED' });

// Cache lookup precedes worker creation. An obsolete request cannot launch a
// worker after navigation, update the screen or overwrite the latest cache.
export function createCachedLayoutTask({ modelId, scope, shape, model, options, cache, compute,
  force = false, onCompute = () => {}, computeDelayMs = 150 }) {
  let stopped = false, computation, timer, wake;
  const key = JSON.stringify([modelId, scope]);
  const promise = (async () => {
    let fingerprint;
    try { fingerprint = await layoutDigest(shape); } catch { /* no crypto: compute normally */ }
    if (stopped) throw cancelled();
    if (!force && fingerprint && modelId != null) {
      try {
        const saved = await cache.get(key, fingerprint);
        if (stopped) throw cancelled();
        if (saved) {
          const restored = restoreLayoutSnapshot(saved, model, options);
          if (candidateValidity(restored).valid) return { ...restored, cacheSource: 'cache', status: 'ready' };
        }
      } catch { /* Invalid/unavailable cache is a miss, not a model error. */ }
    }
    if (stopped) throw cancelled();
    if (computeDelayMs > 0) await new Promise(resolve => { wake = resolve; timer = setTimeout(resolve, computeDelayMs); });
    if (stopped) throw cancelled();
    onCompute(); computation = compute();
    const value = await computation.promise;
    if (stopped) throw cancelled();
    if (fingerprint && modelId != null && candidateValidity(value).valid) {
      try { await cache.put(key, fingerprint, layoutSnapshot(value), () => !stopped); }
      catch { /* Caching is optional; still show the computed diagram. */ }
    }
    if (stopped) throw cancelled();
    return { ...value, cacheSource: 'computed' };
  })();
  return { promise, cancel() { stopped = true; clearTimeout(timer); wake?.(); computation?.cancel(); } };
}
