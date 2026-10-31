"use client";

import { useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import type { CompileResult, Engine, OpenedProject } from "@/types/desktop";

export const ENGINES: Engine[] = ["pdflatex", "xelatex", "lualatex"];

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
  const [content, setContent] = useState(INITIAL_DOCUMENT);
  const [savedContent, setSavedContent] = useState(INITIAL_DOCUMENT);
  const [engine, setEngine] = useState<Engine>("pdflatex");
  const [error, setError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);

  const isDirty = content !== savedContent;

  function applyProject(opened: OpenedProject) {
    setProject(opened);
    setIsOpen(true);
    setActiveFile(opened.activeFile);
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
      setError("Die Datei konnte nicht verarbeitet werden.");
    }
  }

  async function openWith(load: () => Promise<OpenedProject | null> | undefined) {
    if (isDirty && !window.confirm("Ungespeicherte Änderungen verwerfen?")) return;
    await attempt(async () => {
      const opened = await load();
      if (opened) applyProject(opened);
    });
  }

  function resetTo(open: boolean) {
    if (isDirty && !window.confirm("Ungespeicherte Änderungen verwerfen?")) return;
    setProject(null);
    setActiveFile("main.tex");
    setContent(INITIAL_DOCUMENT);
    setSavedContent(INITIAL_DOCUMENT);
    setEngine("pdflatex");
    setCompileResult(null);
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
    if (isDirty) {
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

  async function selectFile(file: string) {
    await attempt(async () => {
      await writeActiveFile();
      const next = await getDesktopApi()?.readFile(file);
      if (next === undefined) return;
      setActiveFile(file);
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
      const mainFile = opened?.mainFile;
      if (!mainFile) throw new Error("No main file");
      setIsCompiling(true);
      try {
        setCompileResult(await api.compile(mainFile, opened ? engine : "pdflatex"));
      } finally {
        setIsCompiling(false);
      }
    });
  }

  return {
    project,
    isOpen,
    activeFile,
    content,
    setContent,
    engine,
    setEngine,
    error,
    isDirty,
    isCompiling,
    compileResult,
    openFile: () => openWith(() => getDesktopApi()?.openFile()),
    openFolder: () => openWith(() => getDesktopApi()?.openFolder()),
    openRecent: (id: string) => openWith(() => getDesktopApi()?.openRecent(id)),
    newDocument: () => resetTo(true),
    close: () => resetTo(false),
    importZip: () => openWith(() => getDesktopApi()?.importZip()),
    save,
    saveAs,
    selectFile,
    compile,
  };
}
