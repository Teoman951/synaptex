import { FileList } from "@/components/layout/FileList";
import type { OutlineItem } from "@/lib/outline";

interface ProjectSidebarProps {
  name: string;
  files: string[];
  activeFile: string;
  mainFile: string | null;
  outline: OutlineItem[];
  onBack: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSelectFile: (file: string) => void;
  onSelectOutline: (line: number) => void;
}

export function ProjectSidebar({
  name,
  files,
  activeFile,
  mainFile,
  outline,
  onBack,
  onSave,
  onSaveAs,
  onSelectFile,
  onSelectOutline,
}: ProjectSidebarProps) {
  const actions = [
    { label: "Speichern", onClick: onSave },
    { label: "Speichern unter", onClick: onSaveAs },
  ];

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line">
      <div className="border-b border-line p-3">
        <button type="button" onClick={onBack} className="text-xs text-muted hover:text-accent">
          ← Projekte
        </button>
        <p title={name} className="mt-2 truncate text-sm font-semibold">
          {name}
        </p>
        <div className="mt-2 flex gap-3">
          {actions.map(({ label, onClick }) => (
            <button key={label} type="button" onClick={onClick} className="text-xs text-muted hover:text-accent">
              {label}
            </button>
          ))}
        </div>
      </div>

      <h2 className="px-3 pt-3 text-xs font-medium">Dateien</h2>
      <div className="min-h-0 flex-1 overflow-auto">
        <FileList files={files} activeFile={activeFile} mainFile={mainFile} onSelect={onSelectFile} />
      </div>

      <h2 className="border-t border-line px-3 pt-3 text-xs font-medium">Gliederung</h2>
      <nav aria-label="Gliederung" className="max-h-[40%] min-h-16 overflow-auto py-2">
        {outline.length === 0 && <p className="px-3 text-xs text-muted">Keine Abschnitte.</p>}
        {outline.map((item) => (
          <button
            key={item.line}
            type="button"
            title={item.title}
            onClick={() => onSelectOutline(item.line)}
            style={{ paddingLeft: `${12 + item.level * 12}px` }}
            className="block w-full truncate py-1 pr-3 text-left text-xs text-muted hover:text-accent"
          >
            {item.title}
          </button>
        ))}
      </nav>

      <button
        type="button"
        disabled
        title="Noch nicht verfügbar"
        className="cursor-not-allowed border-t border-line p-3 text-left text-xs text-muted/60"
      >
        Excel importieren
      </button>
    </aside>
  );
}
