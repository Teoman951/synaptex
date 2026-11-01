import { t } from "@/lib/i18n";
import { useState, type ReactNode } from "react";
import { ProjectSearch } from "@/components/layout/ProjectSearch";
import { FileList } from "@/components/layout/FileList";
import { HistoryPanel } from "@/components/layout/HistoryPanel";
import type { OutlineItem } from "@/types/desktop";

interface ProjectSidebarProps {
  chat: ReactNode;
  name: string;
  files: string[];
  activeFile: string;
  mainFile: string | null;
  outline: OutlineItem[];
  onBack: () => void;
  canSave: boolean;
  onSaveAs: () => void;
  onSelectFile: (file: string) => void;
  onRestoreCheckpoint: (id: string) => void;
  onSelectOutline: (file: string, line: number) => void;
}

export function ProjectSidebar({
  chat,
  name,
  files,
  activeFile,
  mainFile,
  outline,
  onBack,
  canSave,
  onSaveAs,
  onSelectFile,
  onRestoreCheckpoint,
  onSelectOutline,
}: ProjectSidebarProps) {
  const [tab, setTab] = useState<"files" | "chat" | "history">("files");
  const [isSearching, setIsSearching] = useState(false);
  const tabs = [
    { id: "files", label: t("files") },
    { id: "chat", label: t("conversations") },
    { id: "history", label: t("history") },
  ] as const;

  return (
    <aside className={`flex shrink-0 flex-col border-r border-line ${tab === "chat" ? "w-96" : "w-60"}`}>
      <div className="border-b border-line p-3">
        <button type="button" onClick={onBack} className="text-xs text-muted hover:text-accent">
          {t("back")}
        </button>
        <p title={name} className="mt-2 truncate text-sm font-semibold">
          {name}
        </p>
        {/* Saved projects save themselves; only a new document needs a place first. */}
        {canSave && (
          <button type="button" onClick={onSaveAs} className="mt-2 text-xs text-accent hover:underline">
            {t("chooseLocation")}
          </button>
        )}
      </div>

      <div role="tablist" className="flex gap-4 border-b border-line px-3 pt-3">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`pb-2 text-xs font-medium ${tab === id ? "border-b border-foreground" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stays mounted so a running reply survives switching tabs. */}
      <div className={`min-h-0 flex-1 flex-col ${tab === "chat" ? "flex" : "hidden"}`}>{chat}</div>

      {tab === "history" && <HistoryPanel onRestore={onRestoreCheckpoint} />}

      {tab === "files" && (
      <>
      <div className="flex justify-end px-3 pt-2">
        <button
          type="button"
          aria-label={t("searchProject")}
          aria-pressed={isSearching}
          title={t("searchProject")}
          onClick={() => setIsSearching(!isSearching)}
          className={isSearching ? "text-accent" : "text-muted hover:text-accent"}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isSearching ? (
          <ProjectSearch onSelect={onSelectOutline} />
        ) : (
          <FileList files={files} activeFile={activeFile} mainFile={mainFile} onSelect={onSelectFile} />
        )}
      </div>

      <h2 className="border-t border-line px-3 pt-3 text-xs font-medium">{t("outline")}</h2>
      <nav aria-label={t("outline")} className="max-h-[40%] min-h-16 overflow-auto py-2">
        {outline.length === 0 && <p className="px-3 text-xs text-muted">{t("noSections")}</p>}
        {outline.map((item) => (
          <button
            key={`${item.file}:${item.line}`}
            type="button"
            title={item.title}
            onClick={() => onSelectOutline(item.file, item.line)}
            style={{ paddingLeft: `${12 + item.level * 12}px` }}
            className="block w-full truncate py-1 pr-3 text-left text-xs text-muted hover:text-accent"
          >
            {item.title}
          </button>
        ))}
      </nav>
      </>
      )}
    </aside>
  );
}
