export const CONTEXT_OPTIONS = [
  { tokens: 4096, label: "contextSmall" },
  { tokens: 8192, label: "contextMedium" },
  { tokens: 16384, label: "contextLarge" },
];

const STORAGE_KEY = "synaptex.contextTokens";
const DEFAULT_TOKENS = 8192;
// About 1.5 characters per token leaves room for the question and the reply.
const CHARS_PER_CONTEXT_TOKEN = 1.5;

export function readContextTokens() {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return CONTEXT_OPTIONS.some(({ tokens }) => tokens === stored) ? stored : DEFAULT_TOKENS;
  } catch {
    return DEFAULT_TOKENS;
  }
}

export function storeContextTokens(tokens: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(tokens));
  } catch {
    // The choice still applies until the next start.
  }
}

export function contextChars(tokens: number) {
  return tokens * CHARS_PER_CONTEXT_TOKEN;
}
