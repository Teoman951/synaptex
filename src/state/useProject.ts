"use client";

import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import type { CompileResult, Engine, OpenedProject, OutlineItem } from "@/types/desktop";

const FILE_POLL_MS = 3000;
const REMOVED_NOTICE_MS = 5000;

export const ENGINES: Engine[] = ["tectonic", "pdflatex", "xelatex", "lualatex"];

const INITIAL_DOCUMENT = String.raw`\documentclass{article}
\usepackage[utf8]{inputenc}

\title{SynapTeX Startdokument}
\author{Autor}
\date{\today}

\begin{document}

\maketitle

\section{Einleitung}
Willkommen bei SynapTeX! Hier entsteht das Dokument.

\end{document}
`;

export function useProject() {
  const [project, setProject] = useState<OpenedProject | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeFile, setActiveFile] = useState("main.tex");
  const [openFiles, setOpenFiles] = useState(["main.tex"]);
  const [images, setImages] = useState<string[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  // Deleted outside the app: shown greyed out for a moment, then dropped.
  const [removedFiles, setRemovedFiles] = useState<string[]>([]);
  // Open in a tab while deleted, so autosave must not bring them back unasked.
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const [content, setContent] = useState(INITIAL_DOCUMENT);
  const [savedContent, setSavedContent] = useState(INITIAL_DOCUMENT);
  const [engine, setEngine] = useState<Engine>("pdflatex");
  const [error, setError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState<string | null>(null);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);

  const [outline, setOutline] = useState<OutlineItem[]>([]);

  const acceptedFindingsRef = useRef("");

  const isDirty = content !== savedContent;
  const mainFile = project?.mainFile ?? null;

  // savedContent is a dependency so the outline follows every save.
  useEffect(() => {
    if (!mainFile) return;
    let cancelled = false;
    getDesktopApi()
      ?.outline(mainFile)
      .then((items) => {
        if (!cancelled) setOutline(items);
      });
    return () => {
      cancelled = true;
    };
  }, [mainFile, savedContent]);

  useEffect(() => {
    if (!mainFile) return;
    let cancelled = false;
    getDesktopApi()
      ?.projectFiles()
      .then((listed) => {
        if (cancelled) return;
        setImages(listed.images);
        setFolders(listed.folders);
      });
    return () => {
      cancelled = true;
    };
  }, [mainFile]);

  function applyProject(opened: OpenedProject) {
    setProject(opened);
    setIsOpen(true);
    setActiveFile(opened.activeFile);
    setOpenFiles([opened.activeFile]);
    setContent(opened.content);
    setSavedContent(opened.content);
    setEngine(opened.engine);
    setCompileResult(null);
  }

  async function attempt(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch {
      setError(t("fileFailed"));
    }
  }

  async function openWith(load: () => Promise<OpenedProject | null> | undefined) {
    if (isDirty && !window.confirm(t("discardConfirm"))) return;
    await attempt(async () => {
      const opened = await load();
      if (opened) applyProject(opened);
    });
  }

  function resetTo(open: boolean) {
    if (isDirty && !window.confirm(t("discardConfirm"))) return;
    setProject(null);
    setActiveFile("main.tex");
    setOpenFiles(["main.tex"]);
    setContent(INITIAL_DOCUMENT);
    setSavedContent(INITIAL_DOCUMENT);
    setEngine("pdflatex");
    setCompileResult(null);
    setOutline([]);
    setError(null);
    setIsOpen(open);
  }

  async function saveAs() {
    await attempt(async () => {
      const opened = await getDesktopApi()?.saveAs(content);
      if (opened) applyProject(opened);
    });
  }

  // Resolves to false when the document has nowhere to go yet.
  async function writeActiveFile() {
    if (!project) return false;
    if (isDirty && !missingFiles.includes(activeFile)) {
      await getDesktopApi()?.writeFile(activeFile, content);
      setSavedContent(content);
    }
    return true;
  }

  async function save() {
    if (!project) return saveAs();
    await attempt(async () => {
      await writeActiveFile();
    });
  }

  // Closing the active tab moves to its neighbour; the last tab stays open.
  // Polling also picks up files added from outside.
  useEffect(() => {
    if (!mainFile) return;
    const timer = setInterval(async () => {
      const listed = await getDesktopApi()?.projectFiles();
      if (!listed) return;
      setImages(listed.images);
      setFolders(listed.folders);
      setMissingFiles((current) => openFiles.filter((file) => !listed.files.includes(file) && (current.includes(file) || file !== "")));
      setProject((current) => {
        if (!current) return current;
        const gone = current.files.filter((file) => !listed.files.includes(file));
        if (gone.length === 0 && current.files.length === listed.files.length) return current;
        const closed = gone.filter((file) => !openFiles.includes(file));
        setRemovedFiles((removed) => [...new Set([...removed, ...closed])]);
        setTimeout(
          () => setRemovedFiles((removed) => removed.filter((file) => !closed.includes(file))),
          REMOVED_NOTICE_MS,
        );
        return { ...current, files: listed.files };
      });
    }, FILE_POLL_MS);
    return () => clearInterval(timer);
  }, [mainFile, openFiles]);

  function restoreMissingFile() {
    return attempt(async () => {
      await getDesktopApi()?.createFile(activeFile, content);
      setMissingFiles((files) => files.filter((file) => file !== activeFile));
      setSavedContent(content);
      await refreshFiles();
    });
  }

  async function refreshFiles() {
    const listed = await getDesktopApi()?.projectFiles();
    if (!listed) return;
    setImages(listed.images);
    setFolders(listed.folders);
    setProject((current) => (current ? { ...current, files: listed.files } : current));
  }

  function createFile(file: string, content = "") {
    return attempt(async () => {
      const created = await getDesktopApi()?.createFile(file, content);
      await refreshFiles();
      if (created) await selectFile(created);
    });
  }

  function createFolder(folder: string) {
    return attempt(async () => {
      await getDesktopApi()?.createFolder(folder);
      await refreshFiles();
    });
  }

  // Resolves to the project paths of the files that were added.
  async function importFiles(files: File[]) {
    let added: string[] = [];
    await attempt(async () => {
      added = (await getDesktopApi()?.importFiles(files)) ?? [];
      await refreshFiles();
    });
    return added;
  }

  function addImages() {
    return attempt(async () => {
      await getDesktopApi()?.addImages();
      await refreshFiles();
    });
  }

  async function closeFile(file: string) {
    if (openFiles.length === 1) return;
    setMissingFiles((files) => files.filter((item) => item !== file));
    const index = openFiles.indexOf(file);
    const remaining = openFiles.filter((item) => item !== file);
    if (file === activeFile) await selectFile(remaining[Math.max(0, index - 1)]);
    setOpenFiles(remaining);
  }

  async function restoreCheckpoint(id: string) {
    const question = t("restoreConfirm");
    if (!window.confirm(question)) return;
    await attempt(async () => {
      await writeActiveFile();
      const restored = await getDesktopApi()?.restoreCheckpoint(id, activeFile);
      if (restored) applyProject(restored);
    });
  }

  async function selectFile(file: string) {
    await attempt(async () => {
      await writeActiveFile();
      const next = await getDesktopApi()?.readFile(file);
      if (next === undefined) return;
      setActiveFile(file);
      setOpenFiles((files) => (files.includes(file) ? files : [...files, file]));
      setContent(next);
      setSavedContent(next);
    });
  }

  async function compile() {
    const api = getDesktopApi();
    if (!api) return;
    await attempt(async () => {
      let opened = project;
      if (!(await writeActiveFile())) {
        opened = await api.saveAs(content);
        if (!opened) return;
        applyProject(opened);
      }
      // Asks again only when the findings change.
      const findings = await api.scanProject();
      const signature = JSON.stringify(findings);
      if (findings.length > 0 && signature !== acceptedFindingsRef.current) {
        const list = findings
          .slice(0, 8)
          .map(({ file, line, rule }) => `${file}:${line} ${t(`scan.${rule}`)}`)
          .join("\n");
        if (!window.confirm(`${t("scanWarning")}\n\n${list}`)) return;
        acceptedFindingsRef.current = signature;
      }
      const mainFile = opened?.mainFile;
      if (!mainFile) throw new Error("No main file");
      setIsCompiling(true);
      setCompileProgress(t("starting"));
      const stopListening = api.onCompileProgress(setCompileProgress);
      try {
        const result = await api.compile(mainFile, opened ? engine : "pdflatex");
        // A cancelled run leaves the last PDF in place.
        // A failed run does too, while its errors are shown.
        if (!result.cancelled) {
          setCompileResult((previous) => ({ ...result, pdf: result.pdf ?? previous?.pdf ?? null }));
        }
      } finally {
        stopListening();
        setCompileProgress(null);
        setIsCompiling(false);
      }
    });
  }

  return {
    project,
    isOpen,
    activeFile,
    openFiles,
    closeFile,
    images,
    folders,
    removedFiles,
    missingFiles,
    restoreMissingFile,
    refreshFiles,
    createFile,
    createFolder,
    addImages,
    importFiles,
    content,
    setContent,
    engine,
    setEngine,
    error,
    isDirty,
    isCompiling,
    compileProgress,
    compileResult,
    outline,
    openFile: () => openWith(() => getDesktopApi()?.openFile()),
    openFolder: () => openWith(() => getDesktopApi()?.openFolder()),
    openRecent: (id: string) => openWith(() => getDesktopApi()?.openRecent(id)),
    newDocument: () => resetTo(true),
    createFromTemplate: (id: string) => openWith(() => getDesktopApi()?.createFromTemplate(id)),
    close: () => resetTo(false),
    importZip: () => {
      if (!window.confirm(t("zipWarning"))) return;
      return openWith(() => getDesktopApi()?.importZip());
    },
    save,
    saveAs,
    selectFile,
    restoreCheckpoint,
    compile,
    cancelCompile: () => getDesktopApi()?.cancelCompile(),
  };
}
