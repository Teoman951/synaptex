import { unzipSync } from "fflate";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_FILES = 20_000;

// Some archives wrap everything in one folder; the project root is inside it.
function sharedTopFolder(names) {
  const top = names[0]?.split("/")[0];
  const isShared = names.every((name) => name.includes("/") && name.split("/")[0] === top);
  return isShared ? `${top}/` : "";
}

// Archives come from strangers: entries may not leave targetDir, and declared
// sizes are capped before anything is decompressed.
export async function extractZip(zipPath, targetDir) {
  let totalBytes = 0;
  let fileCount = 0;

  const entries = unzipSync(await readFile(zipPath), {
    filter: ({ name, originalSize }) => {
      if (name.endsWith("/") || name.startsWith("__MACOSX/")) return false;
      totalBytes += originalSize;
      fileCount += 1;
      if (totalBytes > MAX_TOTAL_BYTES || fileCount > MAX_FILES) {
        throw new Error("Archive too large");
      }
      return true;
    },
  });

  const names = Object.keys(entries);
  const prefix = sharedTopFolder(names);
  const root = path.resolve(targetDir);

  const targets = names.map((name) => {
    const relative = name.replaceAll("\\", "/").slice(prefix.length);
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) throw new Error(`Unsafe path in archive: ${name}`);
    return [target, entries[name]];
  });

  // Fails when the folder exists, so an import never overwrites anything.
  await mkdir(root);
  try {
    for (const [target, data] of targets) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data);
    }
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
