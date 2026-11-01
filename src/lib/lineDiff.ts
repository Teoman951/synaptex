export interface DiffLine {
  type: "same" | "removed" | "added";
  text: string;
}

// Longest common subsequence over lines.
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before ? before.split("\n") : [];
  const b = after.split("\n");
  const lengths = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] =
        a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (j < b.length && (i === a.length || lengths[i][j + 1] >= lengths[i + 1][j])) {
      lines.push({ type: "added", text: b[j++] });
    } else {
      lines.push({ type: "removed", text: a[i++] });
    }
  }
  return lines;
}
