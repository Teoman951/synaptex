import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from "electron";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compileProject } from "./compiler.mjs";
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
  return /\\usepackage(\[[^\]]*\])?\{(fontspec|unicode-math)\}/.test(source) ? "xelatex" : "pdflatex";
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
  return { mainFile: texFiles[0] ?? null, engine: "pdflatex" };
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

async function loadProject(root, activeFile) {
  const files = await listTextFiles(root);
  const { mainFile, engine } = await detectMainFile(root, files);
  const active = activeFile ?? mainFile;
  if (!active) throw new Error("No .tex file");
  const content = await readFile(path.join(root, active), "utf8");
  projectRoot = root;
  await rememberProject(root);
  return { name: path.basename(root), files, mainFile, engine, activeFile: active, content };
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
    return compileProject({
      projectDir: projectRoot,
      mainFile,
      engine,
      outputDir: path.join(app.getPath("userData"), "build"),
      signal: compileAbort.signal,
      onProgress: (message) => event.sender.send("project:compile-progress", message),
    });
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

app.whenReady().then(() => {
  if (!isDev) serveStaticExport();
  registerProjectHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
