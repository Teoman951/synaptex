import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { text } from "./strings.mjs";

export const ENGINES = ["tectonic", "pdflatex", "xelatex", "lualatex"];

export function hasTexDistribution() {
  const onPath = (process.env.PATH ?? "").split(path.delimiter).some((folder) =>
    existsSync(path.join(folder, process.platform === "win32" ? "pdflatex.exe" : "pdflatex")),
  );
  return onPath || findTool("pdflatex") !== "pdflatex";
}

// The first run may download packages, which takes minutes.
const RUN_TIMEOUT_MS = 600_000;
const MAX_ENGINE_RUNS = 4;

// Apps started before a TeX install still have the old PATH.
function findTool(name) {
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const miktex = path.join(
      process.env.LOCALAPPDATA,
      "Programs", "MiKTeX", "miktex", "bin", "x64", `${name}.exe`,
    );
    if (existsSync(miktex)) return miktex;
  }
  return name;
}

function run(tool, args, options, onOutput) {
  return new Promise((resolve) => {
    const child = execFile(
      tool,
      args,
      { ...options, timeout: RUN_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => resolve({ error, output: `${stdout}${stderr}` }),
    );
    if (onOutput) child.stdout.on("data", (chunk) => onOutput(String(chunk)));
  });
}

// \include writes .aux files next to the source path inside the output folder.
async function mirrorFolders(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      await mirrorFolders(path.join(from, entry.name), path.join(to, entry.name));
    }
  }
}

function parseErrors(log) {
  const errors = new Map();
  for (const line of log.split(/\r?\n/)) {
    const match = line.match(/^(?:error: )?(.+?\.(?:tex|sty|cls)):(\d+): (.*)$/);
    if (!match) continue;
    const file = path.posix.normalize(match[1].replaceAll("\\", "/"));
    const inProject = !path.posix.isAbsolute(file) && !/^[a-z]:/i.test(file) && !file.startsWith("..");
    const error = { message: match[3], file: inProject ? file : null, line: Number(match[2]) };
    errors.set(`${file}:${error.line}:${error.message}`, error);
  }
  if (errors.size === 0) {
    // Engines without file:line output still mark errors with a leading "!".
    for (const line of log.split(/\r?\n/)) {
      if (line.startsWith("! ")) errors.set(line, { message: line.slice(2), file: null, line: null });
    }
  }
  return [...errors.values()];
}

async function runBibliography(baseName, projectDir, outputDir, signal) {
  const env = { ...process.env, BIBINPUTS: `${projectDir}${path.delimiter}` };
  if (existsSync(path.join(outputDir, `${baseName}.bcf`))) {
    return run(
      findTool("biber"),
      ["--input-directory", projectDir, "--output-directory", outputDir, baseName],
      { cwd: projectDir, env, signal },
    );
  }
  const aux = await readFile(path.join(outputDir, `${baseName}.aux`), "utf8").catch(() => "");
  if (/\\bibdata|\\citation/.test(aux)) {
    return run(findTool("bibtex"), [baseName], { cwd: outputDir, env, signal });
  }
  return null;
}

// Maps a point on a PDF page (big points from the top left) to its source line.
export async function locateSource({ projectDir, outputDir, mainFile, page, x, y }) {
  const pdfPath = path.join(outputDir, `${path.basename(mainFile, ".tex")}.pdf`);
  const { output } = await run(findTool("synctex"), ["edit", "-o", `${page}:${x}:${y}:${pdfPath}`, "-d", outputDir], {
    cwd: projectDir,
  });
  const input = output.match(/^Input:(.+)$/m)?.[1]?.trim();
  const line = Number(output.match(/^Line:(\d+)$/m)?.[1]);
  if (!input || !line) return null;
  const file = path.relative(projectDir, path.resolve(projectDir, input)).replaceAll("\\", "/");
  return file.startsWith("..") ? null : { file, line };
}

// The compiler contract: project folder in, PDF and log out. Other backends
// (Tectonic, a remote server) implement the same function.
async function runTectonic({ projectDir, mainFile, outputDir, signal, tectonicPath, onProgress }) {
  onProgress(text("tectonic"));
  const args = [mainFile, "--outdir", outputDir, "--synctex", "--chatter", "minimal"];
  const { error, output } = await run(tectonicPath, args, { cwd: projectDir, signal });
  if (signal?.aborted) return { ok: false, cancelled: true, pdf: null, errors: [], log: output };
  if (error?.code === "ENOENT") {
    return { ok: false, pdf: null, errors: [{ message: text("noTectonic"), file: null, line: null }], log: "" };
  }
  const pdfPath = path.join(outputDir, `${path.basename(mainFile, ".tex")}.pdf`);
  const pdf = existsSync(pdfPath) ? await readFile(pdfPath) : null;
  const errors = parseErrors(output);
  if (!pdf && errors.length === 0) {
    errors.push({ message: text("noPdf"), file: null, line: null });
  }
  return { ok: Boolean(pdf) && errors.length === 0, pdf, errors, log: output };
}

export async function compileProject({ projectDir, mainFile, engine, outputDir, signal, tectonicPath, onProgress = () => {} }) {
  if (!ENGINES.includes(engine)) throw new Error(`Unknown engine: ${engine}`);

  await rm(outputDir, { recursive: true, force: true });
  await mirrorFolders(projectDir, outputDir);

  if (engine === "tectonic") {
    return runTectonic({ projectDir, mainFile, outputDir, signal, tectonicPath, onProgress });
  }

  const tool = findTool(engine);
  const baseName = path.basename(mainFile, ".tex");
  const args = [
    "-interaction=nonstopmode",
    "-no-shell-escape",
    "-synctex=1",
    "-file-line-error",
    `-output-directory=${outputDir}`,
    ...(tool.toLowerCase().includes("miktex") ? ["--enable-installer", "--max-print-line=100000"] : []),
    mainFile,
  ];

  let result;
  let log = "";
  for (let pass = 1; pass <= MAX_ENGINE_RUNS; pass++) {
    onProgress(text("pass", { n: pass }));
    result = await run(tool, args, { cwd: projectDir, signal, env: { ...process.env, max_print_line: "100000" } }, (output) => {
      // Finished pages appear as [n] in the engine output.
      const page = [...output.matchAll(/\[(\d+)[\s\]{<]/g)].at(-1)?.[1];
      if (page) onProgress(text("passPage", { n: pass, page }));
    });
    if (signal?.aborted) return { ok: false, cancelled: true, pdf: null, errors: [], log };
    if (result.error?.code === "ENOENT") {
      return { ok: false, pdf: null, errors: [{ message: text("noCompiler"), file: null, line: null }], log: "" };
    }
    if (result.error?.killed) {
      return { ok: false, pdf: null, errors: [{ message: text("timeout"), file: null, line: null }], log: result.output };
    }
    log = result.output;

    if (pass === 1) {
      onProgress(text("bibliography"));
      const bibliography = await runBibliography(baseName, projectDir, outputDir, signal);
      if (bibliography) log += bibliography.output;
    } else if (!/Rerun to get|Label\(s\) may have changed/.test(result.output)) {
      break;
    }
  }

  const pdfPath = path.join(outputDir, `${baseName}.pdf`);
  const pdf = existsSync(pdfPath) ? await readFile(pdfPath) : null;
  const errors = parseErrors(log);
  if (!pdf && errors.length === 0) errors.push({ message: text("noPdf"), file: null, line: null });
  return { ok: Boolean(pdf) && errors.length === 0, pdf, errors, log };
}
