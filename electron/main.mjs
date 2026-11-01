import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from "electron";
import updater from "electron-updater";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCheckpoint, listCheckpoints, loadCheckpoint } from "./checkpoints.mjs";
import { compileProject, hasTexDistribution, locateSource } from "./compiler.mjs";
import { complete, stopServer } from "./ai.mjs";
import {
  createConversation,
  deleteConversation,
  listConversations,
  loadConversation,
  saveConversation,
} from "./conversations.mjs";
import { downloadFile, installLlamaServer, MODEL_CATALOG } from "./downloads.mjs";
import { detectModels, findGguf, withDetails } from "./models.mjs";
import { buildOutline } from "./outline.mjs";
import { extractZip } from "./zipImport.mjs";

const electronDir = path.dirname(fileURLToPath(import.meta.url));
const exportDir = path.join(electronDir, "..", "out");

const isDev = process.argv.includes("--dev");
const DEV_URL = "http://localhost:3000";
const APP_URL = "app://synaptex";

// Next.js references assets with absolute paths (/_next/...). A custom scheme
// keeps those working, unlike file://, and gives the renderer a real origin.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Next.js bootstraps hydration with inline scripts.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  // CodeMirror injects its styles at runtime.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

function resolveExportPath(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  const resolved = path.resolve(exportDir, relative || "index.html");
  const insideExport = resolved.startsWith(exportDir + path.sep);
  return insideExport ? resolved : null;
}

function serveStaticExport() {
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    const filePath = url.host === "synaptex" ? resolveExportPath(url.pathname) : null;
    if (!filePath) return new Response("Not found", { status: 404 });

    const response = await net.fetch(pathToFileURL(filePath).toString());
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    return new Response(response.body, { status: response.status, headers });
  });
}

// The renderer only sees paths relative to the open project. The project root
// is chosen in a native dialog, so a compromised renderer cannot leave it.
const TEX_FILTERS = [{ name: "LaTeX", extensions: ["tex"] }];
const TEXT_EXTENSIONS = new Set([".tex", ".bib", ".sty", ".cls", ".bst", ".txt", ".md"]);
const IGNORED_FOLDERS = new Set(["node_modules"]);
const FILE_LIMIT = 5000;
const RECENT_LIMIT = 50;
const MAX_THUMBNAIL_LENGTH = 500_000;
let projectRoot = null;
let compileAbort = null;

function projectId(root) {
  return createHash("sha256").update(root).digest("hex");
}

function thumbnailFile(id) {
  return path.join(app.getPath("userData"), "thumbnails", `${id}.txt`);
}

function resolveInProject(relativePath) {
  if (!projectRoot || typeof relativePath !== "string") throw new Error("No project open");
  const resolved = path.resolve(projectRoot, relativePath);
  if (!resolved.startsWith(projectRoot + path.sep)) throw new Error("Path outside project");
  if (!TEXT_EXTENSIONS.has(path.extname(resolved).toLowerCase())) throw new Error("Unsupported file");
  return resolved;
}

async function listTextFiles(root, relative = "") {
  const files = [];
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= FILE_LIMIT || entry.name.startsWith(".")) continue;
    const entryPath = path.posix.join(relative, entry.name);
    if (entry.isDirectory() && !IGNORED_FOLDERS.has(entry.name)) {
      files.push(...(await listTextFiles(root, entryPath)));
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }
  return files;
}

// fontspec and unicode-math do not work with pdflatex.
function detectEngine(source) {
  return /\\usepackage(\[[^\]]*\])?\{(fontspec|unicode-math)\}/.test(source) ? "xelatex" : hasTexDistribution() ? "pdflatex" : "tectonic";
}

async function detectMainFile(root, files) {
  const texFiles = files.filter((file) => file.toLowerCase().endsWith(".tex"));
  const ordered = [...texFiles].sort(
    (a, b) => Number(path.posix.basename(b) === "main.tex") - Number(path.posix.basename(a) === "main.tex"),
  );
  for (const file of ordered) {
    const source = await readFile(path.join(root, file), "utf8");
    if (/^\s*\\documentclass/m.test(source)) return { mainFile: file, engine: detectEngine(source) };
  }
  return { mainFile: texFiles[0] ?? null, engine: hasTexDistribution() ? "pdflatex" : "tectonic" };
}

function recentProjectsFile() {
  return path.join(app.getPath("userData"), "recent-projects.json");
}

async function readRecentProjects() {
  const raw = await readFile(recentProjectsFile(), "utf8").catch(() => "[]");
  const projects = JSON.parse(raw).filter((project) => existsSync(project.path));
  return projects.map((project) => ({
    ...project,
    id: projectId(project.path),
  }));
}

async function rememberProject(root) {
  const others = (await readRecentProjects()).filter((project) => project.path !== root);
  const entry = { path: root, name: path.basename(root), openedAt: Date.now() };
  const recent = [entry, ...others]
    .slice(0, RECENT_LIMIT)
    .map(({ path: projectPath, name, openedAt }) => ({ path: projectPath, name, openedAt }));
  await writeFile(recentProjectsFile(), JSON.stringify(recent), "utf8");
}

function checkpointsFolder() {
  return path.join(app.getPath("userData"), "checkpoints", projectId(projectRoot));
}

async function saveCheckpoint(label) {
  await createCheckpoint(checkpointsFolder(), projectRoot, await listTextFiles(projectRoot), label);
}

async function loadProject(root, activeFile) {
  const files = await listTextFiles(root);
  const { mainFile, engine } = await detectMainFile(root, files);
  const active = activeFile ?? mainFile;
  if (!active) throw new Error("No .tex file");
  const content = await readFile(path.join(root, active), "utf8");
  projectRoot = root;
  await rememberProject(root);
  await saveCheckpoint("Beim Öffnen");
  return { name: path.basename(root), files, mainFile, engine, activeFile: active, content };
}

function tectonicPath() {
  const root = app.isPackaged ? process.resourcesPath : path.join(electronDir, "..", "vendor");
  return path.join(root, "tectonic", "tectonic.exe");
}

function buildFolder() {
  return path.join(app.getPath("userData"), "build");
}

function registerProjectHandlers() {
  ipcMain.handle("project:open-file", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: TEX_FILTERS,
    });
    if (canceled || filePaths.length === 0) return null;
    return loadProject(path.dirname(filePaths[0]), path.basename(filePaths[0]));
  });

  ipcMain.handle("project:open-folder", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      properties: ["openDirectory"],
    });
    if (canceled || filePaths.length === 0) return null;
    return loadProject(filePaths[0]);
  });

  ipcMain.handle("project:import-zip", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const source = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [{ name: "ZIP-Archiv", extensions: ["zip"] }],
    });
    if (source.canceled || source.filePaths.length === 0) return null;
    const zipPath = source.filePaths[0];

    const target = await dialog.showSaveDialog(window, {
      title: "Neuen Projektordner anlegen",
      defaultPath: zipPath.replace(/\.zip$/i, ""),
    });
    if (target.canceled || !target.filePath) return null;

    await extractZip(zipPath, target.filePath);
    return loadProject(target.filePath);
  });

  ipcMain.handle("project:recent", async () =>
    Promise.all(
      (await readRecentProjects()).map(async ({ id, name, openedAt }) => ({
        id,
        name,
        openedAt,
        thumbnail: await readFile(thumbnailFile(id), "utf8").catch(() => null),
      })),
    ),
  );

  ipcMain.handle("project:save-thumbnail", async (_event, dataUrl) => {
    const valid =
      typeof dataUrl === "string" &&
      dataUrl.startsWith("data:image/jpeg;base64,") &&
      dataUrl.length <= MAX_THUMBNAIL_LENGTH;
    if (!projectRoot || !valid) return;
    const file = thumbnailFile(projectId(projectRoot));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, dataUrl, "utf8");
  });

  ipcMain.handle("project:cancel-compile", () => compileAbort?.abort());

  ipcMain.handle("project:open-recent", async (_event, id) => {
    const project = (await readRecentProjects()).find((recent) => recent.id === id);
    if (!project) throw new Error("Unknown project");
    return loadProject(project.path);
  });

  ipcMain.handle("project:outline", (_event, mainFile) => buildOutline(mainFile, resolveInProject));

  ipcMain.handle("checkpoint:list", () => (projectRoot ? listCheckpoints(checkpointsFolder()) : []));

  // The current state is saved first, so a restore can itself be undone.
  ipcMain.handle("checkpoint:restore", async (_event, id, activeFile) => {
    const { files } = await loadCheckpoint(checkpointsFolder(), id);
    await saveCheckpoint("Vor dem Wiederherstellen");
    for (const [file, content] of Object.entries(files)) {
      const target = resolveInProject(file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    }
    return loadProject(projectRoot, activeFile);
  });

  ipcMain.handle("project:locate-source", (_event, mainFile, page, x, y) => {
    resolveInProject(mainFile);
    return locateSource({
      projectDir: projectRoot,
      outputDir: buildFolder(),
      mainFile,
      page: Number(page),
      x: Number(x),
      y: Number(y),
    });
  });

  ipcMain.handle("project:read", (_event, file) => readFile(resolveInProject(file), "utf8"));

  ipcMain.handle("project:write", (_event, file, content) =>
    writeFile(resolveInProject(file), String(content), "utf8"),
  );

  ipcMain.handle("project:save-as", async (event, content) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      defaultPath: "main.tex",
      filters: TEX_FILTERS,
    });
    if (canceled || !filePath) return null;
    await writeFile(filePath, String(content), "utf8");
    return loadProject(path.dirname(filePath), path.basename(filePath));
  });

  ipcMain.handle("project:compile", async (event, mainFile, engine) => {
    resolveInProject(mainFile);
    compileAbort = new AbortController();
    const result = await compileProject({
      projectDir: projectRoot,
      mainFile,
      engine,
      outputDir: buildFolder(),
      tectonicPath: tectonicPath(),
      signal: compileAbort.signal,
      onProgress: (message) => event.sender.send("project:compile-progress", message),
    });
    if (result.pdf) await saveCheckpoint("Nach dem Kompilieren");
    return result;
  });
}

const SYSTEM_PROMPT =
  "Du hilfst beim Schreiben von LaTeX-Dokumenten. Antworte auf Deutsch und knapp. " +
  "Gib LaTeX-Code, der ins Dokument soll, immer als Codeblock mit drei Backticks aus.";
const MAX_CONTEXT_CHARS = 6000;
const RECENT_MESSAGES = 8;
const KEEP_AFTER_COMPRESS = 4;
let aiAbort = null;
let downloadAbort = null;

function aiSettingsFile() {
  return path.join(app.getPath("userData"), "ai-settings.json");
}

function modelsFolder() {
  return path.join(app.getPath("userData"), "models");
}

async function readModelSettings() {
  const raw = await readFile(aiSettingsFile(), "utf8").catch(() => "{}");
  return { serverPath: null, modelPath: null, userModels: [], ...JSON.parse(raw) };
}

function writeModelSettings(settings) {
  return writeFile(aiSettingsFile(), JSON.stringify(settings), "utf8");
}

async function readAiSettings() {
  const settings = await readModelSettings();
  const usable = settings.serverPath && settings.modelPath
    && existsSync(settings.serverPath) && existsSync(settings.modelPath);
  return usable ? settings : null;
}

async function allModels(settings) {
  const detected = [
    ...(await findGguf(modelsFolder(), "SynapTeX")),
    ...(await detectModels(app.getPath("home"), process.env.LOCALAPPDATA)),
  ];
  const known = new Set(detected.map((model) => model.path));
  const added = [...new Set([...settings.userModels, settings.modelPath])]
    .filter((file) => file && !known.has(file))
    .map((file) => ({ path: file, name: path.basename(file, ".gguf"), source: "Hinzugefügt" }));
  const models = await Promise.all([...added, ...detected].map(withDetails));
  return models.filter(Boolean);
}

// The renderer picks models by id, so it can only act on what the list offers.
async function findModel(settings, id) {
  const model = (await allModels(settings)).find((item) => item.id === id);
  if (!model) throw new Error("Unknown model");
  return model;
}

function conversationsFolder() {
  const key = projectRoot ? projectId(projectRoot) : "ohne-projekt";
  return path.join(app.getPath("userData"), "conversations", key);
}

function promptFor(conversation, context) {
  const system = [SYSTEM_PROMPT];
  if (conversation.summary) system.push(`Bisheriger Verlauf: ${conversation.summary}`);
  system.push(`Aktueller Ausschnitt:\n${String(context).slice(0, MAX_CONTEXT_CHARS)}`);
  return [
    { role: "system", content: system.join("\n\n") },
    ...conversation.messages.slice(-RECENT_MESSAGES),
  ];
}

// Replaces all but the latest messages with a summary to save space.
async function compressConversation(folder, conversation, settings) {
  const older = conversation.messages.slice(0, -KEEP_AFTER_COMPRESS);
  if (older.length === 0) return conversation;
  const transcript = older.map(({ role, content }) => `${role}: ${content}`).join("\n");
  const summary = await complete(
    settings,
    [
      {
        role: "user",
        content:
          "Fasse diese Unterhaltung kurz auf Deutsch zusammen und behalte Entscheidungen bei:\n" +
          `${conversation.summary ?? ""}\n${transcript.slice(-MAX_CONTEXT_CHARS)}`,
      },
    ],
    {},
  );
  return saveConversation(folder, {
    ...conversation,
    summary,
    messages: conversation.messages.slice(-KEEP_AFTER_COMPRESS),
  });
}

function registerChatHandlers() {
  ipcMain.handle("ai:configured", async () => Boolean(await readAiSettings()));

  ipcMain.handle("ai:models", async () => {
    const settings = await readModelSettings();
    const models = await allModels(settings);
    return {
      hasServer: Boolean(settings.serverPath && existsSync(settings.serverPath)),
      activeId: models.find((model) => model.path === settings.modelPath)?.id ?? null,
      models: models.map(({ id, name, source, bytes }) => ({ id, name, source, bytes })),
    };
  });

  ipcMain.handle("ai:catalog", () =>
    MODEL_CATALOG.filter(({ file }) => !existsSync(path.join(modelsFolder(), file))).map(
      ({ id, name, bytes }) => ({ id, name, bytes }),
    ),
  );

  ipcMain.handle("ai:cancel-download", () => downloadAbort?.abort());

  ipcMain.handle("ai:download", async (event, id) => {
    const model = MODEL_CATALOG.find((item) => item.id === id);
    if (!model) throw new Error("Unknown model");
    downloadAbort = new AbortController();
    const { signal } = downloadAbort;
    const report = (label) => (share) =>
      event.sender.send("ai:download-progress", { label, percent: Math.floor(share * 100) });

    let settings = await readModelSettings();
    const needsServer = !settings.serverPath || !existsSync(settings.serverPath);
    if (needsServer && process.platform === "win32") {
      const serverPath = await installLlamaServer({
        folder: path.join(app.getPath("userData"), "llama"),
        signal,
        onProgress: report("llama.cpp"),
      });
      settings = { ...settings, serverPath };
      await writeModelSettings(settings);
    }

    const target = path.join(modelsFolder(), model.file);
    await downloadFile({ ...model, target, signal, onProgress: report(model.name) });
    await writeModelSettings({ ...settings, modelPath: target });
  });

  ipcMain.handle("ai:pick-server", async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      title: "llama-server auswählen",
      properties: ["openFile"],
    });
    if (canceled || filePaths.length === 0) return;
    await writeModelSettings({ ...(await readModelSettings()), serverPath: filePaths[0] });
  });

  ipcMain.handle("ai:add-model", async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      title: "GGUF-Modell auswählen",
      properties: ["openFile"],
      filters: [{ name: "GGUF-Modell", extensions: ["gguf"] }],
    });
    if (canceled || filePaths.length === 0) return;
    const settings = await readModelSettings();
    const userModels = [...new Set([...settings.userModels, filePaths[0]])];
    await writeModelSettings({ ...settings, userModels, modelPath: filePaths[0] });
  });

  ipcMain.handle("ai:select-model", async (_event, id) => {
    const settings = await readModelSettings();
    const { path: modelPath } = await findModel(settings, id);
    await writeModelSettings({ ...settings, modelPath });
  });

  ipcMain.handle("ai:remove-model", async (_event, id) => {
    const settings = await readModelSettings();
    const { path: file } = await findModel(settings, id);
    await writeModelSettings({
      ...settings,
      userModels: settings.userModels.filter((item) => item !== file),
      modelPath: settings.modelPath === file ? null : settings.modelPath,
    });
  });

  // Ollama blobs can be shared between models, so they stay with Ollama.
  ipcMain.handle("ai:trash-model", async (_event, id) => {
    const settings = await readModelSettings();
    const model = await findModel(settings, id);
    if (model.source === "Ollama") throw new Error("Managed by Ollama");
    if (settings.modelPath === model.path) stopServer();
    await shell.trashItem(model.path);
    await writeModelSettings({
      ...settings,
      userModels: settings.userModels.filter((item) => item !== model.path),
      modelPath: settings.modelPath === model.path ? null : settings.modelPath,
    });
  });

  ipcMain.handle("chat:list", () => listConversations(conversationsFolder()));
  ipcMain.handle("chat:create", () => saveConversation(conversationsFolder(), createConversation()));
  ipcMain.handle("chat:load", (_event, id) => loadConversation(conversationsFolder(), id));
  ipcMain.handle("chat:delete", (_event, id) => deleteConversation(conversationsFolder(), id));
  ipcMain.handle("ai:cancel", () => aiAbort?.abort());

  ipcMain.handle("chat:compress", async (_event, id) => {
    const folder = conversationsFolder();
    return compressConversation(folder, await loadConversation(folder, id), await readAiSettings());
  });

  ipcMain.handle("chat:send", async (event, id, text, context) => {
    const settings = await readAiSettings();
    if (!settings) throw new Error("AI not configured");
    const folder = conversationsFolder();
    const conversation = await loadConversation(folder, id);
    conversation.messages.push({ role: "user", content: String(text) });
    if (conversation.messages.length === 1) conversation.title = String(text).slice(0, 60);

    aiAbort = new AbortController();
    let reply = "";
    try {
      await complete(settings, promptFor(conversation, context), {
        signal: aiAbort.signal,
        onToken: (token) => {
          reply += token;
          event.sender.send("ai:token", token);
        },
      });
    } catch (error) {
      // A stopped reply keeps what arrived so far.
      if (!aiAbort.signal.aborted) throw error;
    }
    conversation.messages.push({ role: "assistant", content: reply });
    return saveConversation(folder, conversation);
  });
}

function createWindow() {
  const appOrigin = new URL(isDev ? DEV_URL : APP_URL).origin;

  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: "#0b0d12",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(electronDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // pdf.js renders on animation frames, which stop in a throttled window.
      backgroundThrottling: false,
    },
  });

  // The renderer stays on the app itself; external links open in the browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== appOrigin) event.preventDefault();
  });

  if (isDev) window.webContents.openDevTools({ mode: "detach" });
  window.loadURL(isDev ? DEV_URL : `${APP_URL}/index.html`);
}

// Asks before installing. The check is the only request the app makes on its own.
async function checkForUpdates() {
  const { autoUpdater } = updater;
  autoUpdater.autoDownload = false;
  autoUpdater.on("error", () => {});
  autoUpdater.on("update-available", async ({ version }) => {
    const { response } = await dialog.showMessageBox({
      message: `SynapTeX ${version} ist verfügbar. Jetzt herunterladen?`,
      buttons: ["Herunterladen", "Später"],
    });
    if (response === 0) autoUpdater.downloadUpdate();
  });
  autoUpdater.on("update-downloaded", async () => {
    const { response } = await dialog.showMessageBox({
      message: "Das Update ist bereit. Jetzt neu starten?",
      buttons: ["Neu starten", "Später"],
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  await autoUpdater.checkForUpdates().catch(() => {});
}

app.whenReady().then(() => {
  if (!isDev) serveStaticExport();
  registerProjectHandlers();
  registerChatHandlers();
  createWindow();
  if (app.isPackaged) checkForUpdates();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", stopServer);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
