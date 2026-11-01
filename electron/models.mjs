import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const MAX_DEPTH = 7;

export function modelId(modelPath) {
  return createHash("sha256").update(modelPath).digest("hex").slice(0, 16);
}

async function listFiles(folder, depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(folder, entry.name);
      // Hugging Face snapshots are symlinks, which Dirent does not report as files.
      const info = await stat(entryPath).catch(() => null);
      if (info?.isDirectory()) return listFiles(entryPath, depth + 1);
      return info?.isFile() ? [entryPath] : [];
    }),
  );
  return files.flat();
}

export async function findGguf(folder, source) {
  const files = await listFiles(folder);
  return files
    .filter((file) => /\.gguf$/i.test(file) && !/mmproj/i.test(path.basename(file)))
    .map((file) => ({ path: file, name: path.basename(file, ".gguf"), source }));
}

// Ollama keeps models as hash-named blobs, described by one manifest per tag.
async function findOllamaModels(home) {
  const root = path.join(home, ".ollama", "models");
  const manifests = path.join(root, "manifests");
  const models = [];
  for (const manifest of await listFiles(manifests)) {
    const parsed = await readFile(manifest, "utf8").then(JSON.parse).catch(() => null);
    const layer = parsed?.layers?.find((item) => item.mediaType === "application/vnd.ollama.image.model");
    if (!layer) continue;
    const blob = path.join(root, "blobs", layer.digest.replace(":", "-"));
    const [tag, name] = [path.basename(manifest), path.basename(path.dirname(manifest))];
    models.push({ path: blob, name: `${name}:${tag}`, source: "Ollama" });
  }
  return models;
}

export async function detectModels(home, localAppData) {
  const groups = await Promise.all([
    findOllamaModels(home),
    findGguf(path.join(home, ".lmstudio", "models"), "LM Studio"),
    findGguf(path.join(home, ".cache", "lm-studio", "models"), "LM Studio"),
    findGguf(path.join(home, ".cache", "huggingface", "hub"), "Hugging Face"),
    localAppData ? findGguf(path.join(localAppData, "nomic.ai", "GPT4All"), "GPT4All") : [],
  ]);
  return groups.flat();
}

export async function withDetails(model) {
  const info = await stat(model.path).catch(() => null);
  return info ? { ...model, id: modelId(model.path), bytes: info.size } : null;
}
