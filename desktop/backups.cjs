const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { atomicWrite, readModelFile } = require('./files.cjs');
const { MAX_FILE_BYTES } = require('./security.cjs');
const validId = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);

function createBackupStore(directory) {
  let queue = Promise.resolve();
  async function entries() {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const items = [];
    for (const filename of await fs.readdir(directory)) {
      const id = filename.replace(/\.json$/, ''); if (!validId(id) || filename !== `${id}.json`) continue;
      try {
        const item = JSON.parse(await readModelFile(path.join(directory, filename), MAX_FILE_BYTES * 2 + 4096));
        if (item.id === id && typeof item.modelId === 'string' && typeof item.json === 'string' && typeof item.createdAt === 'string') {
          const {json,...metadata}=item; items.push({...metadata,bytes:Buffer.byteLength(json)});
        }
      } catch { /* Keep damaged files in place; never rotate something we cannot read. */ }
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return {
    async list(modelId) { return (await entries()).filter(x => x.modelId === modelId).map(({ json, ...metadata }) => metadata); },
    async read(id) {
      if (!validId(id)) throw new Error('Invalid backup ID');
      const item = JSON.parse(await readModelFile(path.join(directory, `${id}.json`), MAX_FILE_BYTES * 2 + 4096));
      if (item.id !== id || typeof item.json !== 'string' || createHash('sha256').update(item.json).digest('hex') !== item.hash) throw new Error('Backup integrity check failed');
      return { name: item.name, json: item.json };
    },
    create(value, keep = 20) {
      const task = queue.then(async () => {
        if (typeof value?.modelId !== 'string' || value.modelId.length > 128 || typeof value.name !== 'string' || value.name.length > 500 ||
          typeof value.json !== 'string' || Buffer.byteLength(value.json) > MAX_FILE_BYTES) throw new Error('Invalid or oversized backup');
        const document = JSON.parse(value.json);
        if (!Array.isArray(document.tables) || !Array.isArray(document.relationships)) throw new Error('Invalid backup model');
        const all = await entries(), own = all.filter(x => x.modelId === value.modelId);
        const hash = createHash('sha256').update(value.json).digest('hex');
        if (own[0]?.hash === hash) return own[0].id;
        const id = randomUUID(), item = { ...value, id, hash, createdAt: new Date().toISOString() };
        await atomicWrite(path.join(directory, `${id}.json`), JSON.stringify(item));
        // Only generated, successfully parsed backup files are eligible for retention.
        const expired = new Set([...own.slice(Math.max(1, Math.min(50, keep)) - 1), ...all.slice(199)].map(x => x.id));
        for (const oldId of expired) await fs.unlink(path.join(directory, `${oldId}.json`));
        return id;
      });
      queue = task.catch(() => {}); return task;
    },
  };
}
module.exports = { createBackupStore };
