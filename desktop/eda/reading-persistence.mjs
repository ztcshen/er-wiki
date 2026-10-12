// Restore gates and debounced writes are independent from the state owner. A
// pending write never replaces saved data with a partly restored workspace.
export function createReadingPersistence({ write, delayMs = 180, schedule = setTimeout, cancel = clearTimeout }) {
  let timer = null, snapshot, ready = false, disposed = false, dirty = false;
  const flush = () => {
    if (timer !== null) cancel(timer); timer = null;
    if (disposed || !ready || !dirty) return false;
    write(snapshot); dirty = false; return true;
  };
  const queue = () => { if (timer !== null) cancel(timer); timer = ready && dirty ? schedule(() => { timer = null; flush(); }, delayMs) : null; };
  return {
    update(value, settled) { if (disposed) return; snapshot = value; dirty = true; ready = settled; queue(); },
    flush,
    dispose() { if (disposed) return; try { flush(); } finally { if (timer !== null) cancel(timer); timer = null; disposed = true; } },
  };
}
