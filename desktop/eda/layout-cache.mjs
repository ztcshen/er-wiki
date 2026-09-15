export const LAYOUT_CACHE_VERSION = typeof __ER_LAYOUT_CACHE_VERSION__ === 'string'
  ? __ER_LAYOUT_CACHE_VERSION__ : 'layout-cache-v1-development';

export async function layoutDigest(text) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Separate disposable database: never upgrade the model DB, create a backup,
// mark the model dirty or export cache records with the user's JSON.
export function createLayoutCache({ factory = globalThis.indexedDB, name = 'erwiki-layout-cache',
  version = LAYOUT_CACHE_VERSION, maxEntries = 32, maxBytes = 32 * 1024 * 1024,
  maxEntryBytes = 8 * 1024 * 1024, timeoutMs = 350 } = {}) {
  let opening;
  const memory = new Map();
  const remember = record => {
    memory.delete(record.key); memory.set(record.key, record);
    let bytes = [...memory.values()].reduce((sum, r) => sum + r.bytes, 0);
    while (memory.size > Math.min(maxEntries, 8) || bytes > Math.min(maxBytes, 8 * 1024 * 1024)) {
      const first = memory.keys().next().value; bytes -= memory.get(first).bytes; memory.delete(first);
    }
  };
  const connect = async () => {
    if (!factory) return null;
    if (!opening) opening = new Promise(resolve => {
      let settled = false;
      const finish = db => {
        if (settled) { db?.close(); return; }
        settled = true; clearTimeout(timer); resolve(db);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      try {
        const request = factory.open(name, 1);
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('layouts')) request.result.createObjectStore('layouts', { keyPath: 'key' }); };
        request.onerror = request.onblocked = () => finish(null);
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); opening = null; };
          finish(db);
        };
      } catch { finish(null); }
    });
    const db = await opening;
    if (!db) opening = null;
    return db;
  };
  const transact = async (mode, action) => {
    const db = await connect();
    if (!db) return null;
    return new Promise(resolve => {
      let tx, settled = false, result = null;
      const finish = value => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => { try { tx?.abort(); } catch { /* already complete */ } finish(null); }, timeoutMs);
      try {
        tx = db.transaction('layouts', mode);
        tx.oncomplete = () => finish(result);
        tx.onerror = tx.onabort = () => finish(null);
        action(tx.objectStore('layouts'), value => { result = value; });
      } catch { opening = null; finish(null); }
    });
  };
  const decode = async (record, fingerprint) => {
    if (!record || record.version !== version || record.fingerprint !== fingerprint ||
      typeof record.data !== 'string' || record.data.length > maxEntryBytes ||
      !Number.isSafeInteger(record.bytes) || record.bytes < 0 || record.bytes > maxEntryBytes) return null;
    try {
      if (new TextEncoder().encode(record.data).length !== record.bytes) return null;
      if (await layoutDigest(record.data) !== record.checksum) return null;
      const value = JSON.parse(record.data); remember(record); return value;
    } catch { return null; }
  };
  return {
    async get(key, fingerprint) {
      const inMemory = await decode(memory.get(key), fingerprint);
      if (inMemory) return inMemory;
      const record = await transact('readonly', (store, done) => {
        const request = store.get(key); request.onsuccess = () => done(request.result);
      });
      return decode(record, fingerprint);
    },
    async put(key, fingerprint, value, current = () => true) {
      try {
        const data = JSON.stringify(value), bytes = new TextEncoder().encode(data).length;
        if (bytes > maxEntryBytes || bytes > maxBytes || !current()) return false;
        const record = { key, fingerprint, version, data, bytes, checksum: await layoutDigest(data), written: Date.now() };
        if (!current()) return false;
        // Memory reuse still works when disk writes are unavailable or at quota.
        remember(record);
        return !!await transact('readwrite', (store, done) => {
          if (!current()) return;
          store.put(record);
          const request = store.getAll();
          request.onsuccess = () => {
            const records = request.result.sort((a, b) => Number(b.key === record.key) - Number(a.key === record.key) || b.written - a.written || a.key.localeCompare(b.key));
            let used = 0, count = 0;
            for (const r of records) {
              if (r.version !== version || !Number.isSafeInteger(r.bytes) || r.bytes < 0 || ++count > maxEntries || (used += r.bytes) > maxBytes) store.delete(r.key);
            }
            done(true);
          };
        });
      } catch { return false; }
    },
    async close() { memory.clear(); const db = await opening; db?.close(); opening = null; },
  };
}

let shared;
export const desktopLayoutCache = () => shared ||= createLayoutCache();
