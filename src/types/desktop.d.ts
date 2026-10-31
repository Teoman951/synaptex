// Mirrors the API exposed in electron/preload.cjs.
export type Engine = "pdflatex" | "xelatex" | "lualatex";

export interface OpenedProject {
  name: string;
  // Paths are relative to the project root, with forward slashes.
  files: string[];
  mainFile: string | null;
  engine: Engine;
  activeFile: string;
  content: string;
}

export interface RecentProject {
  id: string;
  name: string;
  openedAt: number;
}

export interface CompileError {
  message: string;
  // Null when the error lies outside the project or has no location.
  file: string | null;
  line: number | null;
}

export interface OutlineItem {
  title: string;
  level: number;
  line: number;
  file: string;
}

export interface CompileResult {
  ok: boolean;
  pdf: Uint8Array | null;
  errors: CompileError[];
  log: string;
}

// Dialog-based operations resolve to null when the user cancels.
export interface SynaptexDesktopApi {
  platform: string;
  openFile: () => Promise<OpenedProject | null>;
  openFolder: () => Promise<OpenedProject | null>;
  importZip: () => Promise<OpenedProject | null>;
  recentProjects: () => Promise<RecentProject[]>;
  openRecent: (id: string) => Promise<OpenedProject>;
  outline: (mainFile: string) => Promise<OutlineItem[]>;
  readFile: (file: string) => Promise<string>;
  writeFile: (file: string, content: string) => Promise<void>;
  saveAs: (content: string) => Promise<OpenedProject | null>;
  // Returns a function that stops listening.
  onCompileProgress: (listener: (message: string) => void) => () => void;
  compile: (mainFile: string, engine: Engine) => Promise<CompileResult>;
}

declare global {
  interface Window {
    // Undefined when the UI runs in a plain browser.
    synaptexDesktop?: SynaptexDesktopApi;
  }
}
