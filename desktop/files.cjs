const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { MAX_FILE_BYTES } = require('./security.cjs');

// Write beside the selected target, flush, then replace; a failed write never
// truncates the previous model. The renderer never supplies filesystem paths.
async function atomicWrite(target, contents, { overwrite = true } = {}) {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    if (overwrite) await fs.rename(temporary, target);
    else await fs.link(temporary, target); // Atomic no-clobber publication after flush.
  } finally {
    if (handle) await handle.close();
    await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

async function readModelFile(target, limit = MAX_FILE_BYTES) {
  const handle = await fs.open(target, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error('请选择不超过 20 MB 的模型 JSON 文件');
    const buffer = Buffer.alloc(limit + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > limit) throw new Error('模型文件不能超过 20 MB');
    return buffer.subarray(0, size).toString('utf8');
  } finally { await handle.close(); }
}

module.exports = { atomicWrite, readModelFile };
