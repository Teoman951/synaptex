// Downloads the pinned Tectonic build into vendor/, which electron-builder ships.
import { unzipSync } from "fflate";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

const URL =
  "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-pc-windows-msvc.zip";
const SHA256 = "f61ce51f0b0ade1015b7de7ef368541c5424e9756ecbd0d7af97d6d48030845f";
const TARGET = "vendor/tectonic/tectonic.exe";

if (existsSync(TARGET)) process.exit(0);

const response = await fetch(URL);
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const archive = new Uint8Array(await response.arrayBuffer());

const digest = createHash("sha256").update(archive).digest("hex");
if (digest !== SHA256) throw new Error("Checksum mismatch");

const entries = unzipSync(archive);
await mkdir("vendor/tectonic", { recursive: true });
await writeFile(TARGET, entries["tectonic.exe"]);
