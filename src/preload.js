const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog operations
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),
  previewFile: (filePath) => ipcRenderer.invoke('preview-file', filePath),
  
  // Configuration save/load
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  
  // Automation operations
  startAutomation: (config) => ipcRenderer.invoke('start-automation', config),
  stopAutomation: () => ipcRenderer.invoke('stop-automation'),
  
  // Event listeners
  onProgress: (callback) => {
    ipcRenderer.on('automation-progress', (event, progress) => callback(progress));
  },
  onLog: (callback) => {
    ipcRenderer.on('automation-log', (event, log) => callback(log));
  },
  
  // Remove listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('automation-progress');
    ipcRenderer.removeAllListeners('automation-log');
  }
});
