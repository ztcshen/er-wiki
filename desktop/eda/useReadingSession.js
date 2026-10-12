import { useEffect, useRef, useState } from 'react';
import { cleanLocation, loadReadingState, scopeKey, restoreLocation, normalizeReadingState } from './reading-state.mjs';
import { cleanReadingLayout } from './reading-layout.mjs';
import { restoreWorkspaceState } from './reading-workspaces.mjs';

export function useReadingSession(modelId, model, ready) {
  const [state, setState] = useState(() => loadReadingState(localStorage, modelId));
  const [history, setHistory] = useState([]), [error, setError] = useState('');
  const latest = useRef(state); latest.current = state;
  const apply = change => { const next = typeof change === 'function' ? change(latest.current) : change; latest.current = next; setState(next); };
  const location = state.location, key = scopeKey(location), rememberedView = state.views[key], view = rememberedView || [0, 0, 1000, 700];
  const updateLocation = change => apply(s => ({ ...s, location: cleanLocation({ ...s.location, ...change }) }));
  const setPart = name => value => apply(s => ({ ...s, location: cleanLocation({ ...s.location,
    [name]: typeof value === 'function' ? value(s.location[name]) : value }) }));
  const setView = value => apply(s => {
    const k = scopeKey(s.location), old = s.views[k] || [0, 0, 1000, 700];
    return { ...s, views: { ...s.views, [k]: typeof value === 'function' ? value(old) : value } };
  });
  const navigate = (level, domainId = '', tableId = null, selection = {}) => {
    setHistory(h => [...h.slice(-49), { location: latest.current.location, view }]);
    updateLocation({ level, domainId, tableId, selectedTable: tableId, selectedField: null, selectedNet: null, selectedRelation: null, expanded: [], ...selection });
  };
  const restore = entry => { const next = restoreLocation(entry.location, model);
    apply(s => ({ ...s, location: next, views: entry.view ? { ...s.views, [scopeKey(next)]: entry.view } : s.views })); };
  const back = () => { if (!history.length) return; restore(history.at(-1)); setHistory(h => h.slice(0, -1)); };
  const addBookmark = name => { if (name.trim()) apply(s => ({ ...s, bookmarks: [...s.bookmarks.slice(-49), { id: crypto.randomUUID(), name: name.trim().slice(0, 120), location: s.location, view }] })); };
  const openBookmark = bookmark => { setHistory(h => [...h.slice(-49), { location, view }]); restore(bookmark); };
  const removeBookmark = id => apply(s => ({ ...s, bookmarks: s.bookmarks.filter(b => b.id !== id) }));
  const toggleDomain = id => apply(s => ({ ...s, collapsedDomains: s.collapsedDomains.includes(id) ? s.collapsedDomains.filter(v => v !== id) : [...s.collapsedDomains, id] }));
  const expandDomains = () => apply(s => ({ ...s, collapsedDomains: [] }));
  useEffect(() => {
    if (!ready) return;
    const valid = restoreLocation(latest.current.location, model);
    if (JSON.stringify(valid) !== JSON.stringify(latest.current.location)) apply(s => ({ ...s, location: valid }));
  }, [model, ready]);
  return { state, getState: () => latest.current, setError, location, setPart, view, setView, rememberedView, navigate, back, canBack: !!history.length,
    bookmarks: state.bookmarks, addBookmark, openBookmark, removeBookmark, error, collapsedDomains: state.collapsedDomains, toggleDomain, expandDomains,
    layout: state.layout, setReadingLayout: value => apply(s => ({ ...s, layout: cleanReadingLayout(typeof value === 'function' ? value(s.layout) : value) })),
    queryId: state.queryId, setQueryId: value => apply(s => ({ ...s, queryId: value })),
    restoreWorkspace: snapshot => { setHistory(h => [...h.slice(-49), { location, view }]); apply(s => normalizeReadingState(restoreWorkspaceState(s, snapshot, model))); },
  };
}
