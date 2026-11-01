// MCP server that reads shared projects and only ever proposes changes, started by the AI client over stdio.
// Runs without Electron APIs: the app launches it with ELECTRON_RUN_AS_NODE.
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

const dataFolder = process.argv[2];
const PROTOCOL_VERSION = "2024-11-05";
const TEXT_EXTENSIONS = new Set([".tex", ".bib", ".sty", ".cls", ".bst", ".txt", ".md"]);
const MAX_FILES = 5000;
const MAX_MATCHES = 100;
const MAX_PROPOSAL_CHARS = 200_000;
const MAX_PROPOSALS = 100;

const TOOLS = [
  {
    name: "list_projects",
    description: "Lists the SynapTeX projects the user has shared.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_files",
    description: "Lists the text files of a shared project.",
    inputSchema: { type: "object", properties: { project: { type: "string" } }, required: ["project"] },
  },
  {
    name: "read_file",
    description: "Reads a text file of a shared project.",
    inputSchema: {
      type: "object",
      properties: { project: { type: "string" }, file: { type: "string" } },
      required: ["project", "file"],
    },
  },
  {
    name: "search",
    description: "Searches the text files of a shared project.",
    inputSchema: {
      type: "object",
      properties: { project: { type: "string" }, query: { type: "string" } },
      required: ["project", "query"],
    },
  },
  {
    name: "propose_edit",
    description:
      "Proposes replacing old_text with new_text in a file of a shared project. Nothing changes until the user approves it in SynapTeX. old_text must occur exactly once.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string" },
        file: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" },
        reason: { type: "string" },
      },
      required: ["project", "file", "old_text", "new_text"],
    },
  },
];

// Read on every call, so turning a project off applies at once.
async function sharedProjects() {
  const raw = await readFile(path.join(dataFolder, "mcp-projects.json"), "utf8").catch(() => "[]");
  return JSON.parse(raw);
}

async function projectRoot(name) {
  const project = (await sharedProjects()).find((item) => item.name === name);
  if (!project) throw new Error("This project is not shared.");
  return project.path;
}

async function listTextFiles(root, relative = "") {
  const files = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    if (files.length >= MAX_FILES || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const entryPath = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await listTextFiles(root, entryPath)));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(entryPath);
  }
  return files;
}

function resolveFile(root, file) {
  const target = path.resolve(root, String(file));
  const inside = target.startsWith(path.resolve(root) + path.sep);
  if (!inside || !TEXT_EXTENSIONS.has(path.extname(target).toLowerCase())) {
    throw new Error("This file is not available.");
  }
  return target;
}

async function callTool(name, args) {
  if (name === "list_projects") return (await sharedProjects()).map((item) => item.name).join("\n");

  const root = await projectRoot(args.project);
  if (name === "list_files") return (await listTextFiles(root)).join("\n");
  if (name === "read_file") return readFile(resolveFile(root, args.file), "utf8");
  if (name === "search") {
    const needle = String(args.query).toLowerCase();
    const matches = [];
    for (const file of await listTextFiles(root)) {
      const lines = (await readFile(path.join(root, file), "utf8")).split(/\r?\n/);
      for (const [index, text] of lines.entries()) {
        if (matches.length < MAX_MATCHES && text.toLowerCase().includes(needle)) {
          matches.push(`${file}:${index + 1}: ${text.trim()}`);
        }
      }
    }
    return matches.join("\n");
  }
  if (name === "propose_edit") {
    const [oldText, newText] = [String(args.old_text ?? ""), String(args.new_text ?? "")];
    if (!oldText || oldText.length + newText.length > MAX_PROPOSAL_CHARS) throw new Error("The change is empty or too large.");
    const source = await readFile(resolveFile(root, args.file), "utf8");
    if (source.split(oldText).length !== 2) throw new Error("old_text must occur exactly once in the file.");

    const folder = path.join(dataFolder, "mcp-proposals");
    await mkdir(folder, { recursive: true });
    if ((await readdir(folder)).length >= MAX_PROPOSALS) throw new Error("Too many open proposals.");
    const id = randomUUID();
    const proposal = { id, at: Date.now(), project: args.project, file: String(args.file), oldText, newText, reason: String(args.reason ?? "").slice(0, 500) };
    await writeFile(path.join(folder, `${id}.json`), JSON.stringify(proposal), "utf8");
    return "Proposal saved. It is not applied until the user approves it in SynapTeX.";
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function logAccess(tool, args) {
  const entry = { at: Date.now(), tool, project: args.project ?? null, file: args.file ?? null };
  await appendFile(path.join(dataFolder, "mcp-log.jsonl"), `${JSON.stringify(entry)}\n`).catch(() => {});
}

async function handle({ method, params }) {
  if (method === "initialize") {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "synaptex", version: "0.1.0" },
    };
  }
  if (method === "ping") return {};
  if (method === "tools/list") return { tools: TOOLS };
  if (method === "tools/call") {
    const args = params.arguments ?? {};
    await logAccess(params.name, args);
    try {
      return { content: [{ type: "text", text: await callTool(params.name, args) }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error.message }] };
    }
  }
  throw Object.assign(new Error("Method not found"), { code: -32601 });
}

const respond = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);

createInterface({ input: process.stdin }).on("line", async (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    respond({ id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  // Notifications carry no id and get no response.
  if (message.id === undefined) return;
  try {
    respond({ id: message.id, result: await handle(message) });
  } catch (error) {
    respond({ id: message.id, error: { code: error.code ?? -32603, message: error.message } });
  }
});
