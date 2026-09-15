const { randomUUID } = require("node:crypto");

// Correlated native commands fail closed on timeout or renderer termination.
function createCommandBridge(getWindow, timeoutMs = 120000) {
  const pending = new Map();
  const settle = (id, result) => {
    const finish = pending.get(id);
    if (!finish) return false;
    const detail = result && typeof result === 'object' ? result : { ok: result === true };
    finish({ ...detail, ok: detail.ok === true });
    return true;
  };
  return {
    async request(action) {
      return (await this.requestDetailed(action)).ok;
    },
    requestDetailed(action) {
      const window = getWindow();
      if (!window || window.isDestroyed()) return Promise.resolve({ ok: false, errorCode: 'WORKSPACE_UNAVAILABLE', message: 'Workspace unavailable' });
      const id = randomUUID();
      return new Promise((resolve) => {
        const timer = setTimeout(() => settle(id, { ok: false, errorCode: 'COMMAND_TIMEOUT', message: 'Command timed out' }), timeoutMs);
        pending.set(id, (ok) => {
          clearTimeout(timer);
          pending.delete(id);
          resolve(ok);
        });
        try {
          window.webContents.send("desktop:command", { ...(typeof action === 'string' ? { action } : action), id });
        } catch {
          settle(id, { ok: false, errorCode: 'COMMAND_SEND_FAILED', message: 'Command could not be delivered' });
        }
      });
    },
    settle,
    cancelAll() {
      for (const id of [...pending.keys()]) settle(id, { ok: false, errorCode: 'COMMAND_CANCELLED', message: 'Workspace terminated' });
    },
    get pendingCount() {
      return pending.size;
    },
  };
}
module.exports = { createCommandBridge };
