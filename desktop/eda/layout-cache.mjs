export const LAYOUT_CACHE_VERSION = typeof __ER_LAYOUT_CACHE_VERSION__ === 'string' ? __ER_LAYOUT_CACHE_VERSION__ : 'layout-cache-v1-development';
export const LAYOUT_DATABASE_VERSION = 2;
export async function layoutDigest(text) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Identity references and immutable content blobs live in a disposable database.
// Its schema and eviction never touch the user's model database or model JSON.
export function createLayoutCache({ factory = globalThis.indexedDB, name = 'erwiki-layout-cache', version = LAYOUT_CACHE_VERSION,
  maxEntries = 32, maxBytes = 32 * 1024 * 1024, maxEntryBytes = 8 * 1024 * 1024, timeoutMs = 350 } = {}) {
  let opening; const refs = new Map(), contents = new Map();
  const remember = (ref, content) => {
    refs.delete(ref.key); refs.set(ref.key, ref); contents.delete(content.key); contents.set(content.key, content);
    while (refs.size > Math.min(maxEntries, 8)) refs.delete(refs.keys().next().value);
    const live = new Set([...refs.values()].map(r => r.contentKey));
    for (const key of contents.keys()) if (!live.has(key)) contents.delete(key);
    let bytes = [...contents.values()].reduce((sum, r) => sum + r.bytes, 0);
    while (bytes > Math.min(maxBytes, 8 * 1024 * 1024) && contents.size) {
      const key = contents.keys().next().value; bytes -= contents.get(key).bytes; contents.delete(key);
      for (const [id, r] of refs) if (r.contentKey === key) refs.delete(id);
    }
  };
  const connect = async () => {
    if (!factory) return null;
    if (!opening) opening = new Promise(resolve => {
      let settled = false;
      const finish = db => { if (settled) { db?.close(); return; } settled = true; clearTimeout(timer); resolve(db); };
      const timer = setTimeout(() => finish(null), timeoutMs);
      try {
        const request = factory.open(name, LAYOUT_DATABASE_VERSION);
        request.onupgradeneeded = () => { for (const store of ['layouts', 'contents']) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'key' }); };
        request.onerror = request.onblocked = () => finish(null);
        request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); opening = null; }; finish(db); };
      } catch { finish(null); }
    });
    const db = await opening; if (!db) opening = null; return db;
  };
  const transact = async (mode, action) => {
    const db = await connect(); if (!db) return null;
    return new Promise(resolve => {
      let tx, settled = false, result = null;
      const finish = value => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => { try { tx?.abort(); } catch {} finish(null); }, timeoutMs);
      try { tx = db.transaction(['layouts', 'contents'], mode); tx.oncomplete = () => finish(result); tx.onerror = tx.onabort = () => finish(null);
        action(tx.objectStore('layouts'), tx.objectStore('contents'), value => { result = value; });
      } catch { opening = null; finish(null); }
    });
  };
  const decode = async (ref, content, fingerprint) => {
    if (!ref || ref.version !== version || ref.fingerprint !== fingerprint || !content || content.version !== version ||
      content.key !== `${version}:${content.checksum}` || ref.contentKey !== undefined && ref.contentKey !== content.key ||
      typeof content.data !== 'string' || content.data.length > maxEntryBytes || !Number.isSafeInteger(content.bytes) || content.bytes < 0 || content.bytes > maxEntryBytes) return null;
    try {
      if (new TextEncoder().encode(content.data).length !== content.bytes || await layoutDigest(content.data) !== content.checksum) return null;
      const value = JSON.parse(content.data);
      remember({ ...ref, contentKey: content.key }, content); return value;
    } catch { return null; }
  };
  return {
    async get(key, fingerprint) {
      const ref = refs.get(key), memory = await decode(ref, contents.get(ref?.contentKey), fingerprint); if (memory) return memory;
      const record = await transact('readonly', (identity, blobs, done) => {
        const request = identity.get(key); request.onsuccess = () => {
          const r = request.result; if (!r) { done(null); return; }
          // Legacy v1 layout values remain readable; they are replaced lazily.
          if (typeof r.data === 'string') { done({ ref: r, content: { ...r, key: `${r.version}:${r.checksum}` } }); return; }
          const body = blobs.get(r.contentKey); body.onsuccess = () => done({ ref: r, content: body.result });
        };
      });
      return decode(record?.ref, record?.content, fingerprint);
    },
    async put(key, fingerprint, value, current = () => true) {
      try {
        const data = JSON.stringify(value), bytes = new TextEncoder().encode(data).length;
        if (bytes > maxEntryBytes || bytes > maxBytes || !current()) return false;
        const checksum = await layoutDigest(data); if (!current()) return false;
        const written = Date.now(), contentKey = `${version}:${checksum}`,
          content = { key: contentKey, version, checksum, bytes, data, written },
          ref = { key, version, fingerprint, contentKey, written };
        remember(ref, content);
        return !!await transact('readwrite', (identities, blobs, done) => {
          if (!current()) return;
          identities.put(ref); blobs.put(content);
          const referenceRead = identities.getAll(); referenceRead.onsuccess = () => {
            const blobRead = blobs.getAll(); blobRead.onsuccess = () => {
              const available = new Map(blobRead.result.map(r => [r.key, r])), kept = new Set(); let count = 0, used = 0;
              const records = referenceRead.result.sort((a, b) => Number(b.key === key) - Number(a.key === key) || b.written - a.written || a.key.localeCompare(b.key));
              for (const r of records) {
                const body = available.get(r.contentKey), extra = kept.has(r.contentKey) ? 0 : body?.bytes;
                if (r.version !== version || !body || !Number.isSafeInteger(extra) || extra < 0 || count >= maxEntries || used + extra > maxBytes) identities.delete(r.key);
                else { count++; used += extra; kept.add(r.contentKey); }
              }
              for (const body of blobRead.result) if (!kept.has(body.key)) blobs.delete(body.key);
              done(true);
            };
          };
        });
      } catch { return false; }
    },
    async close() { refs.clear(); contents.clear(); const db = await opening; db?.close(); opening = null; },
  };
}
let shared;
export const desktopLayoutCache = () => shared ||= createLayoutCache();
