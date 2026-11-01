import { readFile } from "node:fs/promises";
import path from "node:path";

// A heuristic, not a sandbox: TeX macros can hide any of these from a text
// search. It catches plain attempts and tells the user why to look closer.
const OUTSIDE_PATH = String.raw`\s*\{?\s*(?:[a-zA-Z]:[\\/]|[\\/]|~|[^}\n]*\.\.[\\/])`;
const FILE_COMMANDS = "input|include|InputIfFileExists|includegraphics(?:\\[[^\\]]*\\])?|verbatiminput|lstinputlisting(?:\\[[^\\]]*\\])?|bibliography|addbibresource";

const RULES = [
  { id: "outsidePath", pattern: new RegExp(String.raw`\\(?:${FILE_COMMANDS})${OUTSIDE_PATH}`) },
  { id: "rawFileAccess", pattern: /\\(?:openin|openout|pdffiledump|pdfshellescape|directlua|luaexec)\b/ },
  { id: "shellCommand", pattern: /\\(?:write18|ShellEscape|immediate\s*\\write\s*18)/ },
  { id: "hiddenCommand", pattern: /\\(?:catcode\s*`?\\?\\|csname\s+(?:input|openin|openout|write)|\^\^5c)|\^\^5c/ },
];

const SCANNED = new Set([".tex", ".sty", ".cls", ".bbx", ".cbx", ".def", ".cfg", ".ltx"]);

export async function scanProject(root, files) {
  const findings = [];
  for (const file of files) {
    if (!SCANNED.has(path.extname(file).toLowerCase())) continue;
    const source = await readFile(path.join(root, file), "utf8").catch(() => "");
    for (const [index, raw] of source.split(/\r?\n/).entries()) {
      const line = raw.split(/(?<!\\)%/)[0];
      const rule = RULES.find(({ pattern }) => pattern.test(line));
      if (rule) findings.push({ file, line: index + 1, rule: rule.id });
    }
  }
  return findings;
}
