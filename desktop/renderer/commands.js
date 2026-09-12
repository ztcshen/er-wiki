export function workspaceCommand(action, value = {}) {
  return new Promise(resolve => window.dispatchEvent(new CustomEvent('erwiki-command', { detail: { action, ...value, resolve } })));
}
export const openPanel = name => window.dispatchEvent(new CustomEvent('erwiki-open-panel', { detail: name }));
