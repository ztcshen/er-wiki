const { contextBridge, ipcRenderer } = require('electron');

// Fixed capabilities only: no generic IPC, paths, Node, or shell access.
contextBridge.exposeInMainWorld('erDesktop', Object.freeze({
  openModel: kind => ipcRenderer.invoke('desktop:open-model', kind),
  exportModel: (name, json) => ipcRenderer.invoke('desktop:export-model', { name, json }),
  exportAsset: payload => ipcRenderer.invoke('desktop:export-asset', payload),
  getPreferences: () => ipcRenderer.invoke('desktop:get-preferences'),
  setPreferences: value => ipcRenderer.invoke('desktop:set-preferences', value),
  createBackup: (value, automatic = false) => ipcRenderer.invoke('desktop:create-backup', value, automatic),
  listBackups: modelId => ipcRenderer.invoke('desktop:list-backups', modelId),
  readBackup: id => ipcRenderer.invoke('desktop:read-backup', id),
  checkUpdates: () => ipcRenderer.invoke('desktop:check-updates'),
  openResource: resource => ipcRenderer.invoke('desktop:open-resource', resource),
  confirmLeave: () => ipcRenderer.invoke('desktop:confirm-leave'),
  confirmReplace: value => ipcRenderer.invoke('desktop:confirm-replace', value),
  workspaceReady: modelId => ipcRenderer.send('desktop:workspace-ready', modelId),
  requestClose: () => ipcRenderer.invoke('desktop:request-close'),
  commandResult: (id, result) => ipcRenderer.send('desktop:command-result', { id, result }),
  onCommand: callback => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('desktop:command', listener);
    return () => ipcRenderer.removeListener('desktop:command', listener);
  },
}));
