"use client";

import { useMemo, useState } from "react";
import { t } from "@/lib/i18n";

interface TreeFolder {
  folders: Map<string, TreeFolder>;
  items: { name: string; path: string; isImage: boolean }[];
}

function emptyFolder(): TreeFolder {
  return { folders: new Map(), items: [] };
}

function folderAt(root: TreeFolder, parts: string[]) {
  let current = root;
  for (const part of parts) {
    if (!current.folders.has(part)) current.folders.set(part, emptyFolder());
    current = current.folders.get(part) as TreeFolder;
  }
  return current;
}

function buildTree(files: string[], images: string[], folders: string[]) {
  const root = emptyFolder();
  for (const folder of folders) folderAt(root, folder.split("/"));
  for (const [paths, isImage] of [[files, false], [images, true]] as const) {
    for (const file of paths) {
      const parts = file.split("/");
      const name = parts.pop() as string;
      folderAt(root, parts).items.push({ name, path: file, isImage });
    }
  }
  return root;
}

interface FileListProps {
  files: string[];
  removedFiles: string[];
  images: string[];
  folders: string[];
  activeFile: string;
  mainFile: string | null;
  onSelect: (file: string) => void;
  onInsertImage: (image: string) => void;
}

export function FileList({ files, removedFiles, images, folders, activeFile, mainFile, onSelect, onInsertImage }: FileListProps) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const tree = useMemo(() => buildTree([...files, ...removedFiles], images, folders), [files, removedFiles, images, folders]);

  function toggle(path: string) {
    setClosed((current) => {
      const next = new Set(current);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  }

  function renderFolder(folder: TreeFolder, parent: string, depth: number) {
    const indent = { paddingLeft: `${12 + depth * 12}px` };
    const subfolders = [...folder.folders.entries()].sort(([a], [b]) => a.localeCompare(b));
    const items = [...folder.items].sort((a, b) => a.name.localeCompare(b.name));
    return (
      <>
        {subfolders.map(([name, child]) => {
          const path = parent ? `${parent}/${name}` : name;
          const isOpen = !closed.has(path);
          return (
            <div key={path}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(path)}
                style={indent}
                className="block w-full truncate py-1 pr-3 text-left text-xs hover:text-accent"
              >
                {isOpen ? "▾" : "▸"} {name}
              </button>
              {isOpen && renderFolder(child, path, depth + 1)}
            </div>
          );
        })}
        {items.map(({ name, path, isImage }) => (
          <button
            key={path}
            type="button"
            title={isImage ? t("insertImage") : path}
            disabled={removedFiles.includes(path)}
            onClick={() => (isImage ? onInsertImage(path) : onSelect(path))}
            style={indent}
            className={`block w-full truncate py-1 pr-3 text-left text-xs hover:text-accent ${
              path === activeFile ? "bg-surface text-accent" : "text-muted"
            } ${removedFiles.includes(path) ? "line-through opacity-50" : ""}`}
          >
            {isImage ? "🖼 " : ""}
            {name}
            {path === mainFile && t("mainFile")}
            {removedFiles.includes(path) && ` (${t("fileRemoved")})`}
          </button>
        ))}
      </>
    );
  }

  return (
    <nav aria-label={t("files")} className="py-2">
      {renderFolder(tree, "", 0)}
    </nav>
  );
}
