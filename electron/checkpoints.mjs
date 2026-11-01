import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_CHECKPOINTS = 20;
const MAX_TOTAL_CHARS = 50 * 1024 * 1024;
const ID_PATTERN = /^\d+$/;

function checkpointFile(folder, id) {
  if (!ID_PATTERN.test(id)) throw new Error("Invalid checkpoint id");
  return path.join(folder, `${id}.json`);
}

async function checkpointIds(folder) {
  const names = await readdir(folder).catch(() => []);
  return names
    .map((name) => path.basename(name, ".json"))
    .sort((a, b) => Number(b) - Number(a));
}

export async function loadCheckpoint(folder, id) {
  return JSON.parse(await readFile(checkpointFile(folder, id), "utf8"));
}

// Stores all text files. Skips the write when nothing changed since the latest one.
export async function createCheckpoint(folder, root, relativeFiles, label) {
  const files = {};
  let totalChars = 0;
  for (const file of relativeFiles) {
    // A locked or vanished file must not block opening the project.
    const content = await readFile(path.join(root, file), "utf8").catch(() => null);
    if (content === null || totalChars + content.length > MAX_TOTAL_CHARS) continue;
    totalChars += content.length;
    files[file] = content;
  }
  const hash = createHash("sha256").update(JSON.stringify(files)).digest("hex");

  const ids = await checkpointIds(folder);
  if (ids[0] && (await loadCheckpoint(folder, ids[0])).hash === hash) return;

  const id = String(Date.now());
  await mkdir(folder, { recursive: true });
  await writeFile(checkpointFile(folder, id), JSON.stringify({ id, label, hash, files }), "utf8");
  for (const old of [id, ...ids].slice(MAX_CHECKPOINTS)) await rm(checkpointFile(folder, old), { force: true });
}

export async function listCheckpoints(folder) {
  const ids = await checkpointIds(folder);
  return Promise.all(
    ids.map(async (id) => {
      const { label, files } = await loadCheckpoint(folder, id);
      return { id, label, createdAt: Number(id), fileCount: Object.keys(files).length };
    }),
  );
}
