"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

interface NewItemBarProps {
  onCreateFile: (name: string) => void;
  onCreateFolder: (name: string) => void;
  onAddImages: () => void;
}

export function NewItemBar({ onCreateFile, onCreateFolder, onAddImages }: NewItemBarProps) {
  const [mode, setMode] = useState<"file" | "folder" | null>(null);
  const [name, setName] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (trimmed) (mode === "file" ? onCreateFile : onCreateFolder)(trimmed);
    setMode(null);
    setName("");
  }

  const actions = [
    { label: t("newFile"), onClick: () => setMode("file") },
    { label: t("newFolder"), onClick: () => setMode("folder") },
    { label: t("addImage"), onClick: onAddImages },
  ];

  return (
    <div className="px-3 pt-2 text-xs">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {actions.map(({ label, onClick }) => (
          <button key={label} type="button" onClick={onClick} className="text-muted hover:text-accent">
            {label}
          </button>
        ))}
      </div>
      {mode && (
        <input
          autoFocus
          value={name}
          aria-label={t("itemName")}
          placeholder={mode === "file" ? "kapitel/neu.tex" : "bilder"}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setMode(null)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
            if (event.key === "Escape") setMode(null);
          }}
          className="mt-2 w-full rounded border border-line bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      )}
    </div>
  );
}
