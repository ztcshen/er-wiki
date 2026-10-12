import { useEffect, useRef } from 'react';
import { createFrameMailbox } from './frame-mailbox.mjs';

export function useFrameValue(value, commit, scope) {
  const current = useRef(value), callback = useRef(commit), pending = useRef(null), box = useRef(null), scopeRef = useRef(scope);
  current.current = value; callback.current = commit;
  if (scopeRef.current !== scope) { box.current?.clear(); pending.current = null; scopeRef.current = scope; }
  useEffect(() => {
    const owner = createFrameMailbox({ publish: next => { pending.current = null; current.current = next; callback.current(next); } }); box.current = owner;
    return () => { owner.dispose(); box.current = null; pending.current = null; };
  }, []);
  return {
    set(next) { const previous = pending.current ? pending.current.value : current.current;
      const updated = typeof next === 'function' ? next(previous) : next;
      pending.current = { value: updated };
      if (box.current) box.current.push(updated); else { pending.current = null; current.current = updated; callback.current(updated); } },
    flush() { box.current?.flush(); },
    clear() { box.current?.clear(); pending.current = null; },
    get latest() { return pending.current ? pending.current.value : current.current; },
  };
}
