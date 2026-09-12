export function workspaceCommand(action, value = {}) {
  return new Promise(resolve => window.dispatchEvent(new CustomEvent('erwiki-command', { detail: { action, ...value, resolve } })));
}
export const openPanel = name => window.dispatchEvent(new CustomEvent('erwiki-open-panel', { detail: name }));
export const edaCommand = (action, payload) => window.dispatchEvent(new CustomEvent('erwiki-eda-command', {
  detail: payload ? { action, ...payload } : action,
}));
export const openCommandPalette = (query = '') => window.dispatchEvent(new CustomEvent('erwiki-open-command-palette', {
  detail: { query: typeof query === 'string' ? query : '' },
}));
