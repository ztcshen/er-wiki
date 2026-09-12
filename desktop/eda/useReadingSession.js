import { useEffect, useRef, useState } from 'react';
import { cleanLocation, loadReadingState, saveReadingState, scopeKey, restoreLocation } from './reading-state.mjs';

export function useReadingSession(modelId, model, ready) {
  const [state, setState] = useState(() => loadReadingState(localStorage, modelId));
  const [history, setHistory] = useState([]), [error, setError] = useState('');
  const latest = useRef(state); latest.current = state;
  const location = state.location, key = scopeKey(location), rememberedView = state.views[key];
  const view = rememberedView || [0, 0, 1000, 700];
  const updateLocation = change => setState(s => ({ ...s, location: cleanLocation({ ...s.location, ...change }) }));
  const setPart = name => value => setState(s => ({ ...s, location: cleanLocation({ ...s.location,
    [name]: typeof value === 'function' ? value(s.location[name]) : value }) }));
  const setView = value => setState(s => {
    const k = scopeKey(s.location), old = s.views[k] || [0, 0, 1000, 700];
    return { ...s, views: { ...s.views, [k]: typeof value === 'function' ? value(old) : value } };
  });
  const navigate = (level, domainId = '', tableId = null, selection = {}) => {
    setHistory(h => [...h.slice(-49), { location, view }]);
    updateLocation({ level, domainId, tableId, selectedTable: tableId, selectedField: null, selectedNet: null, selectedRelation: null, expanded: [], ...selection });
  };
  const restore = entry => {
    const next = restoreLocation(entry.location, model);
    setState(s => ({ ...s, location: next, views: entry.view ? { ...s.views, [scopeKey(next)]: entry.view } : s.views }));
  };
  const back = () => { if (!history.length) return; restore(history.at(-1)); setHistory(h => h.slice(0, -1)); };
  const addBookmark = name => {
    if (!name.trim()) return;
    setState(s => ({ ...s, bookmarks: [...s.bookmarks.slice(-49), { id: crypto.randomUUID(), name: name.trim().slice(0, 120), location: s.location, view }] }));
  };
  const openBookmark = bookmark => { setHistory(h => [...h.slice(-49), { location, view }]); restore(bookmark); };
  const removeBookmark = id => setState(s => ({ ...s, bookmarks: s.bookmarks.filter(b => b.id !== id) }));
  const toggleDomain = id => setState(s => ({ ...s, collapsedDomains: s.collapsedDomains.includes(id)
    ? s.collapsedDomains.filter(value => value !== id) : [...s.collapsedDomains, id] }));
  const expandDomains = () => setState(s => ({ ...s, collapsedDomains: [] }));
  useEffect(() => {
    if (!ready) return;
    const valid = restoreLocation(latest.current.location, model);
    if (JSON.stringify(valid) !== JSON.stringify(latest.current.location)) setState(s => ({ ...s, location: valid }));
  }, [model, ready]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { try { saveReadingState(localStorage, modelId, latest.current); setError(''); }
      catch { setError('阅读状态无法写入本机存储；模型内容未受影响。'); } }, 180);
    return () => clearTimeout(timer);
  }, [state, modelId, ready]);
  useEffect(() => () => {
    if (ready) try { saveReadingState(localStorage, modelId, latest.current); } catch { /* In-session error is shown above. */ }
  }, [modelId, ready]);
  return { location, setPart, view, setView, rememberedView, navigate, back, canBack: !!history.length,
    bookmarks: state.bookmarks, addBookmark, openBookmark, removeBookmark, error,
    collapsedDomains: state.collapsedDomains, toggleDomain, expandDomains };
}
