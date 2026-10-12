import { useEffect, useRef, useState } from 'react';
import { cleanWorkspaceSnapshot, loadReadingWorkspaces, saveReadingWorkspaces } from './reading-workspaces.mjs';

export function useReadingWorkspaces(modelId, ready) {
  const [workspaces, setWorkspaces] = useState(() => loadReadingWorkspaces(localStorage, modelId)), [error, setError] = useState('');
  const latest = useRef(workspaces); latest.current = workspaces;
  const save = (name, snapshot) => {
    if (!ready || !name.trim()) return false;
    const cleanName = name.trim().slice(0, 120), old = latest.current.find(w => w.name === cleanName);
    const value = { id: old?.id || crypto.randomUUID(), name: cleanName, snapshot: cleanWorkspaceSnapshot(snapshot) };
    const next = old ? latest.current.map(w => w.id === old.id ? value : w) : [...latest.current.slice(-29), value];
    try { saveReadingWorkspaces(localStorage, modelId, next); latest.current = next; setWorkspaces(next); setError(''); return value; }
    catch { setError('阅读工作区无法写入本机存储'); return false; }
  };
  const remove = id => {
    const next = latest.current.filter(w => w.id !== id);
    try { saveReadingWorkspaces(localStorage, modelId, next); latest.current = next; setWorkspaces(next); setError(''); } catch { setError('阅读工作区无法写入本机存储'); }
  };
  useEffect(() => { if (ready) setError(''); }, [ready]);
  return { workspaces, save, remove, error };
}
