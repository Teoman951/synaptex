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
  thumbnail: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  summary: string | null;
  messages: ChatMessage[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  bytes: number;
}

export interface Checkpoint {
  id: string;
  label: string;
  createdAt: number;
  fileCount: number;
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
  cancelled?: boolean;
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
  cancelCompile: () => Promise<void>;
  saveThumbnail: (dataUrl: string) => Promise<void>;
  aiConfigured: () => Promise<boolean>;
  configureAi: () => Promise<boolean>;
  cancelAi: () => Promise<void>;
  onAiToken: (listener: (token: string) => void) => () => void;
  listConversations: () => Promise<ConversationSummary[]>;
  createConversation: () => Promise<Conversation>;
  loadConversation: (id: string) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  compressConversation: (id: string) => Promise<Conversation>;
  sendMessage: (id: string, text: string, context: string) => Promise<Conversation>;
  listCheckpoints: () => Promise<Checkpoint[]>;
  restoreCheckpoint: (id: string, activeFile: string) => Promise<OpenedProject>;
  compile: (mainFile: string, engine: Engine) => Promise<CompileResult>;
}

declare global {
  interface Window {
    // Undefined when the UI runs in a plain browser.
    synaptexDesktop?: SynaptexDesktopApi;
  }
}
