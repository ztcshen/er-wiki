// Latest-value delivery owns exactly one frame handle, including handle zero.
// Generation guards also reject callbacks delivered after cancellation/disposal.
export function createFrameMailbox({ publish, request = callback => requestAnimationFrame(callback), cancel = id => cancelAnimationFrame(id) }) {
  let handle = null, value, pending = false, disposed = false, generation = 0;
  const flush = () => {
    if (disposed || !pending) return;
    if (handle !== null) { cancel(handle); generation++; }
    handle = null; const next = value; value = undefined; pending = false; publish(next);
  };
  return {
    push(next) {
      if (disposed) return;
      value = next; pending = true;
      if (handle !== null) return;
      const token = generation;
      handle = request(() => { if (disposed || token !== generation) return; handle = null; flush(); });
    },
    flush,
    clear() { generation++; if (handle !== null) cancel(handle); handle = null; pending = false; value = undefined; },
    dispose() { if (disposed) return; this.clear(); disposed = true; },
    get pending() { return pending; },
  };
}
