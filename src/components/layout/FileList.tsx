interface FileListProps {
  files: string[];
  activeFile: string;
  mainFile: string | null;
  onSelect: (file: string) => void;
}

export function FileList({ files, activeFile, mainFile, onSelect }: FileListProps) {
  return (
    <nav aria-label="Projektdateien" className="py-2">
      {files.map((file) => (
        <button
          key={file}
          type="button"
          title={file}
          onClick={() => onSelect(file)}
          className={`block w-full truncate px-3 py-1 text-left text-xs hover:text-accent ${
            file === activeFile ? "bg-surface text-accent" : "text-muted"
          }`}
        >
          {file}
          {file === mainFile && " (Haupt)"}
        </button>
      ))}
    </nav>
  );
}
