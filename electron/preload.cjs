const { contextBridge, ipcRenderer } = require("electron");

// The only bridge between renderer and main process. Future IPC goes here as
// narrow, named functions; never expose ipcRenderer itself.
// Keep in sync with src/types/desktop.d.ts.
contextBridge.exposeInMainWorld("synaptexDesktop", {
  platform: process.platform,
  openFile: () => ipcRenderer.invoke("project:open-file"),
  openFolder: () => ipcRenderer.invoke("project:open-folder"),
  importZip: () => ipcRenderer.invoke("project:import-zip"),
  recentProjects: () => ipcRenderer.invoke("project:recent"),
  openRecent: (id) => ipcRenderer.invoke("project:open-recent", id),
  readFile: (file) => ipcRenderer.invoke("project:read", file),
  writeFile: (file, content) => ipcRenderer.invoke("project:write", file, content),
  saveAs: (content) => ipcRenderer.invoke("project:save-as", content),
  compile: (mainFile, engine) => ipcRenderer.invoke("project:compile", mainFile, engine),
});
