// Mirrors the API exposed in electron/preload.cjs.
export type Engine = "tectonic" | "pdflatex" | "xelatex" | "lualatex";

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

export interface AiModel {
  id: string;
  name: string;
  source: string;
  bytes: number;
}

export interface CatalogModel {
  id: string;
  name: string;
  bytes: number;
}

export interface DownloadProgress {
  label: string;
  percent: number;
}

export interface ModelOverview {
  hasServer: boolean;
  activeId: string | null;
  models: AiModel[];
}

// Where a suggested change would land.
export interface EditTarget {
  file: string;
  line: number;
  from: number;
  to: number;
  before: string;
}

export interface EditorContext {
  file: string;
  text: string;
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

export interface ProjectTemplate {
  id: string;
  name: string;
  category: string;
}

export interface SearchMatch {
  file: string;
  line: number;
  text: string;
}

export interface McpState {
  connected: boolean;
  projects: { id: string; name: string; shared: boolean }[];
  log: { at: number; tool: string; project: string | null; file: string | null }[];
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
  modelCatalog: () => Promise<CatalogModel[]>;
  downloadModel: (id: string) => Promise<void>;
  cancelDownload: () => Promise<void>;
  onDownloadProgress: (listener: (progress: DownloadProgress) => void) => () => void;
  listModels: () => Promise<ModelOverview>;
  pickServer: () => Promise<void>;
  addModel: () => Promise<void>;
  selectModel: (id: string) => Promise<void>;
  removeModel: (id: string) => Promise<void>;
  trashModel: (id: string) => Promise<void>;
  cancelAi: () => Promise<void>;
  onAiToken: (listener: (token: string) => void) => () => void;
  listConversations: () => Promise<ConversationSummary[]>;
  createConversation: () => Promise<Conversation>;
  loadConversation: (id: string) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  compressConversation: (id: string) => Promise<Conversation>;
  sendMessage: (id: string, text: string, context: EditorContext) => Promise<Conversation>;
  listCheckpoints: () => Promise<Checkpoint[]>;
  restoreCheckpoint: (id: string, activeFile: string) => Promise<OpenedProject>;
  locateSource: (
    mainFile: string,
    page: number,
    x: number,
    y: number,
  ) => Promise<{ file: string; line: number } | null>;
  savePdf: (mainFile: string) => Promise<void>;
  installServer: () => Promise<void>;
  listTemplates: () => Promise<ProjectTemplate[]>;
  createFromTemplate: (id: string) => Promise<OpenedProject | null>;
  searchProject: (query: string) => Promise<SearchMatch[]>;
  setLanguage: (language: string) => Promise<void>;
  mcpState: () => Promise<McpState>;
  mcpConnect: () => Promise<void>;
  mcpDisconnect: () => Promise<void>;
  mcpShare: (id: string, shared: boolean) => Promise<void>;
  compile: (mainFile: string, engine: Engine) => Promise<CompileResult>;
}

declare global {
  interface Window {
    // Undefined when the UI runs in a plain browser.
    synaptexDesktop?: SynaptexDesktopApi;
  }
}
