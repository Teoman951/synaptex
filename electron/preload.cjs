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
  outline: (mainFile) => ipcRenderer.invoke("project:outline", mainFile),
  readFile: (file) => ipcRenderer.invoke("project:read", file),
  writeFile: (file, content) => ipcRenderer.invoke("project:write", file, content),
  saveAs: (content) => ipcRenderer.invoke("project:save-as", content),
  onCompileProgress: (listener) => {
    const handler = (_event, message) => listener(message);
    ipcRenderer.on("project:compile-progress", handler);
    return () => ipcRenderer.off("project:compile-progress", handler);
  },
  cancelCompile: () => ipcRenderer.invoke("project:cancel-compile"),
  saveThumbnail: (dataUrl) => ipcRenderer.invoke("project:save-thumbnail", dataUrl),
  aiConfigured: () => ipcRenderer.invoke("ai:configured"),
  modelCatalog: () => ipcRenderer.invoke("ai:catalog"),
  downloadModel: (id) => ipcRenderer.invoke("ai:download", id),
  cancelDownload: () => ipcRenderer.invoke("ai:cancel-download"),
  onDownloadProgress: (listener) => {
    const handler = (_event, progress) => listener(progress);
    ipcRenderer.on("ai:download-progress", handler);
    return () => ipcRenderer.off("ai:download-progress", handler);
  },
  listModels: () => ipcRenderer.invoke("ai:models"),
  pickServer: () => ipcRenderer.invoke("ai:pick-server"),
  addModel: () => ipcRenderer.invoke("ai:add-model"),
  selectModel: (id) => ipcRenderer.invoke("ai:select-model", id),
  removeModel: (id) => ipcRenderer.invoke("ai:remove-model", id),
  trashModel: (id) => ipcRenderer.invoke("ai:trash-model", id),
  cancelAi: () => ipcRenderer.invoke("ai:cancel"),
  onAiToken: (listener) => {
    const handler = (_event, token) => listener(token);
    ipcRenderer.on("ai:token", handler);
    return () => ipcRenderer.off("ai:token", handler);
  },
  listConversations: () => ipcRenderer.invoke("chat:list"),
  createConversation: () => ipcRenderer.invoke("chat:create"),
  loadConversation: (id) => ipcRenderer.invoke("chat:load", id),
  deleteConversation: (id) => ipcRenderer.invoke("chat:delete", id),
  compressConversation: (id) => ipcRenderer.invoke("chat:compress", id),
  sendMessage: (id, text, context) => ipcRenderer.invoke("chat:send", id, text, context),
  listCheckpoints: () => ipcRenderer.invoke("checkpoint:list"),
  restoreCheckpoint: (id, activeFile) => ipcRenderer.invoke("checkpoint:restore", id, activeFile),
  locateSource: (mainFile, page, x, y) => ipcRenderer.invoke("project:locate-source", mainFile, page, x, y),
  savePdf: (mainFile) => ipcRenderer.invoke("project:save-pdf", mainFile),
  installServer: () => ipcRenderer.invoke("ai:install-server"),
  listTemplates: () => ipcRenderer.invoke("template:list"),
  createFromTemplate: (id) => ipcRenderer.invoke("template:create", id),
  searchProject: (query) => ipcRenderer.invoke("project:search", query),
  setLanguage: (language) => ipcRenderer.invoke("app:set-language", language),
  mcpState: () => ipcRenderer.invoke("mcp:state"),
  mcpConnect: () => ipcRenderer.invoke("mcp:connect"),
  mcpDisconnect: () => ipcRenderer.invoke("mcp:disconnect"),
  mcpShare: (id, shared) => ipcRenderer.invoke("mcp:share", id, shared),
  exportZip: (id) => ipcRenderer.invoke("project:export-zip", id),
  revealProject: (id) => ipcRenderer.invoke("project:reveal", id),
  scanProject: () => ipcRenderer.invoke("project:scan"),
  cloudState: () => ipcRenderer.invoke("ai:cloud-state"),
  cloudSave: (provider, model, apiKey) => ipcRenderer.invoke("ai:cloud-save", provider, model, apiKey),
  cloudRemoveKey: (provider) => ipcRenderer.invoke("ai:cloud-remove-key", provider),
  cloudActivate: (active) => ipcRenderer.invoke("ai:cloud-activate", active),
  mcpProposals: () => ipcRenderer.invoke("mcp:proposals"),
  mcpApprove: (id) => ipcRenderer.invoke("mcp:approve", id),
  mcpReject: (id) => ipcRenderer.invoke("mcp:reject", id),
  compile: (mainFile, engine) => ipcRenderer.invoke("project:compile", mainFile, engine),
});
