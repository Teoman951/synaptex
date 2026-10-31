export interface OutlineItem {
  title: string;
  level: number;
  line: number;
}

const SECTION = /^\s*\\(section|subsection|subsubsection)\*?\{(.*)\}/;
const LEVELS: Record<string, number> = { section: 0, subsection: 1, subsubsection: 2 };

export function parseOutline(source: string): OutlineItem[] {
  return source.split("\n").flatMap((text, index) => {
    const match = text.match(SECTION);
    return match ? [{ title: match[2], level: LEVELS[match[1]], line: index + 1 }] : [];
  });
}
