const { contextBridge, ipcRenderer } = require('electron');

// Fixed capabilities only: no generic IPC, paths, Node, or shell access.
contextBridge.exposeInMainWorld('erDesktop', Object.freeze({
  openModel: () => ipcRenderer.invoke('desktop:open-model'),
  exportModel: (name, json) => ipcRenderer.invoke('desktop:export-model', { name, json }),
  confirmLeave: () => ipcRenderer.invoke('desktop:confirm-leave'),
  requestClose: () => ipcRenderer.invoke('desktop:request-close'),
  commandResult: (id, ok) => ipcRenderer.send('desktop:command-result', { id, ok }),
  onCommand: callback => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('desktop:command', listener);
    return () => ipcRenderer.removeListener('desktop:command', listener);
  },
}));
