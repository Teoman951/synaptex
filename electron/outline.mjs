import { readFile } from "node:fs/promises";

const COMMAND =
  /\\(chapter|section|subsection|subsubsection|input|include)\*?(?:\[[^\]]*\])?\{(.*)\}/;
const LEVELS = { chapter: 0, section: 1, subsection: 2, subsubsection: 3 };

// Follows \input and \include from the main file, in document order.
// resolve maps a project-relative path to a real path and throws outside it.
export async function buildOutline(file, resolve, visited = new Set()) {
  if (visited.has(file)) return [];
  visited.add(file);

  const source = await readFile(resolve(file), "utf8").catch(() => null);
  if (source === null) return [];

  const items = [];
  const lines = source.split(/\r?\n/);
  for (const [index, text] of lines.entries()) {
    const match = text.split(/(?<!\\)%/)[0].match(COMMAND);
    if (!match) continue;
    const [, command, argument] = match;
    if (command in LEVELS) {
      items.push({ title: argument, level: LEVELS[command], line: index + 1, file });
    } else {
      const included = argument.endsWith(".tex") ? argument : `${argument}.tex`;
      items.push(...(await buildOutline(included, resolve, visited)));
    }
  }
  return items;
}
