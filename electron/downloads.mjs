import { unzipSync } from "fflate";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Pinned hashes: a download only counts when it matches exactly.
export const MODEL_CATALOG = [
  {
    id: "qwen3-8b",
    name: "Qwen3 8B",
    file: "Qwen3-8B-Q4_K_M.gguf",
    bytes: 5027783488,
    sha256: "d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785",
    url: "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf",
  },
  {
    id: "mistral-7b",
    name: "Mistral 7B",
    file: "mistral-7b-instruct-v0.2.Q4_K_M.gguf",
    bytes: 4368439584,
    sha256: "3e0039fd0273fcbebb49228943b17831aadd55cbcbf56f0af00499be2040ccf9",
    url: "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
  },
];

const LLAMA_WINDOWS = {
  bytes: 24574627,
  sha256: "07e81782f5a16c7ffef42403183808e02f271c9ece3aa2d64040b2620ae8d519",
  url: "https://github.com/ggml-org/llama.cpp/releases/download/b12020/llama-b12020-bin-win-cpu-x64.zip",
};

export async function downloadFile({ url, target, sha256, bytes, signal, onProgress }) {
  await mkdir(path.dirname(target), { recursive: true });
  const partial = `${target}.part`;
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status}`);

  const hash = createHash("sha256");
  const file = await open(partial, "w");
  let received = 0;
  try {
    for await (const chunk of response.body) {
      await file.write(chunk);
      hash.update(chunk);
      received += chunk.length;
      onProgress(received / bytes);
    }
    await file.close();
    if (hash.digest("hex") !== sha256) throw new Error("Checksum mismatch");
    await rename(partial, target);
  } catch (error) {
    await file.close().catch(() => {});
    await rm(partial, { force: true });
    throw error;
  }
}

// Unpacks llama.cpp into folder and returns the path of llama-server.exe.
export async function installLlamaServer({ folder, signal, onProgress }) {
  const archive = path.join(folder, "llama.zip");
  await downloadFile({ ...LLAMA_WINDOWS, target: archive, signal, onProgress });
  const entries = unzipSync(await readFile(archive));
  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith("/")) continue;
    const target = path.resolve(folder, name);
    if (!target.startsWith(path.resolve(folder) + path.sep)) throw new Error("Unsafe path in archive");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  await rm(archive, { force: true });
  return path.join(folder, "llama-server.exe");
}
