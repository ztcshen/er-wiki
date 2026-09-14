const { randomUUID } = require("node:crypto");

// Correlated native commands fail closed on timeout or renderer termination.
function createCommandBridge(getWindow, timeoutMs = 120000) {
  const pending = new Map();
  const settle = (id, ok) => {
    const finish = pending.get(id);
    if (!finish) return false;
    finish(ok === true);
    return true;
  };
  return {
    request(action) {
      const window = getWindow();
      if (!window || window.isDestroyed()) return Promise.resolve(false);
      const id = randomUUID();
      return new Promise((resolve) => {
        const timer = setTimeout(() => settle(id, false), timeoutMs);
        pending.set(id, (ok) => {
          clearTimeout(timer);
          pending.delete(id);
          resolve(ok);
        });
        try {
          window.webContents.send("desktop:command", { ...(typeof action === 'string' ? { action } : action), id });
        } catch {
          settle(id, false);
        }
      });
    },
    settle,
    cancelAll() {
      for (const id of [...pending.keys()]) settle(id, false);
    },
    get pendingCount() {
      return pending.size;
    },
  };
}
module.exports = { createCommandBridge };
