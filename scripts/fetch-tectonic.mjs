// Downloads the pinned Tectonic build into vendor/, which electron-builder ships.
import { unzipSync } from "fflate";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";

const BASE = "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0";
const BUILDS = {
  win32: {
    file: "tectonic-0.17.0-x86_64-pc-windows-msvc.zip",
    sha256: "f61ce51f0b0ade1015b7de7ef368541c5424e9756ecbd0d7af97d6d48030845f",
    binary: "tectonic.exe",
  },
  // musl is statically linked, so it runs on any distribution.
  linux: {
    file: "tectonic-0.17.0-x86_64-unknown-linux-musl.tar.gz",
    sha256: "8533d07f9ccbd7a65824b9e0459041bca34af1eb33daba48f59215593753a3b7",
    binary: "tectonic",
  },
};

const build = BUILDS[process.platform];
if (!build) throw new Error(`No Tectonic build for ${process.platform}`);

const folder = "vendor/tectonic";
if (existsSync(`${folder}/${build.binary}`)) process.exit(0);

const response = await fetch(`${BASE}/${build.file}`);
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const archive = new Uint8Array(await response.arrayBuffer());

const digest = createHash("sha256").update(archive).digest("hex");
if (digest !== build.sha256) throw new Error("Checksum mismatch");

await mkdir(folder, { recursive: true });
if (build.file.endsWith(".zip")) {
  await writeFile(`${folder}/${build.binary}`, unzipSync(archive)[build.binary]);
} else {
  await writeFile(`${folder}/tectonic.tar.gz`, archive);
  execFileSync("tar", ["-xzf", "tectonic.tar.gz"], { cwd: folder });
  await rm(`${folder}/tectonic.tar.gz`);
}
