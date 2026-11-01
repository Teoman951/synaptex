"use client";

import { language, t } from "@/lib/i18n";
import dynamic from "next/dynamic";
import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import type { EditorView } from "@uiw/react-codemirror";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PaneHeader } from "@/components/layout/PaneHeader";
import { ProjectHome } from "@/components/layout/ProjectHome";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { PdfPreview } from "@/components/preview/PdfPreview";
import { contextChars, readContextTokens } from "@/lib/contextSize";
import { getDesktopApi } from "@/lib/desktop";
import { useProject } from "@/state/useProject";
import type { EditTarget } from "@/types/desktop";

// CodeMirror needs the DOM, so it must never render during the static export.
const LatexEditor = dynamic(() => import("@/components/editor/LatexEditor"), {
  ssr: false,
});

const AUTO_COMPILE_KEY = "synaptex.autoCompile";
const AUTO_SAVE_DELAY_MS = 1500;
const FONT_SIZE_KEY = "synaptex.editorFontSize";
const SPLIT_KEY = "synaptex.editorShare";
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 28;
const MIN_SHARE = 0.2;
const MAX_SHARE = 0.8;

function readNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  try {
    return Number(window.localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function storeValue(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // The setting still applies for this session.
  }
}

function readAutoCompile() {
  try {
    return window.localStorage.getItem(AUTO_COMPILE_KEY) === "true";
  } catch {
    return false;
  }
}

export function Workspace() {
  const project = useProject();

  useEffect(() => {
    getDesktopApi()?.setLanguage(language);
  }, []);
  const { save, saveAs, content } = project;
  const [renderFailed, setRenderFailed] = useState(false);
  const [autoCompile, setAutoCompile] = useState(
    () => typeof window !== "undefined" && readAutoCompile(),
  );
  const [fontSize, setFontSize] = useState(() => readNumber(FONT_SIZE_KEY, 14));
  const [editorShare, setEditorShare] = useState(() => readNumber(SPLIT_KEY, 0.5));
  const [layoutVersion, setLayoutVersion] = useState(0);
  const panesRef = useRef<HTMLDivElement>(null);
  const onRenderError = useCallback(() => setRenderFailed(true), []);
  const editorRef = useRef<EditorView | null>(null);
  const pendingJumpRef = useRef<{ file: string; line: number } | null>(null);
  const onEditorReady = useCallback((view: EditorView) => {
    editorRef.current = view;
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!project.isOpen) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (event.shiftKey) saveAs();
        else save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function changeFontSize(next: number) {
    setFontSize(next);
    storeValue(FONT_SIZE_KEY, next);
  }

  function dragSplitter(event: PointerEvent<HTMLDivElement>) {
    const panes = panesRef.current;
    if (!panes || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const box = panes.getBoundingClientRect();
    const share = (event.clientX - box.left) / box.width;
    setEditorShare(Math.min(MAX_SHARE, Math.max(MIN_SHARE, share)));
  }

  function finishSplitterDrag() {
    storeValue(SPLIT_KEY, editorShare);
    setLayoutVersion((version) => version + 1);
  }

  function startCompile() {
    setRenderFailed(false);
    project.compile();
  }

  function changeAutoCompile(enabled: boolean) {
    setAutoCompile(enabled);
    try {
      window.localStorage.setItem(AUTO_COMPILE_KEY, String(enabled));
    } catch {
      // The toggle still works for this session.
    }
  }

  // Saving clears isDirty, and compiling saves first, so this cannot loop.
  // Runs after every render, which restarts the delay on each keystroke.
  useEffect(() => {
    if (!project.project || !project.isDirty || project.isCompiling) return;
    const timer = setTimeout(autoCompile ? startCompile : save, AUTO_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  });

  function getEditorContext() {
    const view = editorRef.current;
    const file = project.activeFile;
    const contextTokens = readContextTokens();
    const windowChars = contextChars(contextTokens);
    if (!view) return { file, text: content, contextTokens };
    const { from, to, head } = view.state.selection.main;
    if (from !== to) return { file, text: view.state.sliceDoc(from, to), contextTokens };
    // Without a selection, send the part around the cursor.
    const start = Math.max(0, head - windowChars / 2);
    return { file, text: content.slice(start, start + windowChars), contextTokens };
  }

  function getEditTarget(): EditTarget | null {
    const view = editorRef.current;
    if (!view) return null;
    const { from, to } = view.state.selection.main;
    return {
      file: project.activeFile,
      line: view.state.doc.lineAt(from).number,
      from,
      to,
      before: view.state.sliceDoc(from, to),
    };
  }

  // Applies only if the target is still what the preview showed.
  function applyToEditor(target: EditTarget, code: string) {
    const view = editorRef.current;
    if (!view || target.file !== project.activeFile) return false;
    if (view.state.sliceDoc(target.from, target.to) !== target.before) return false;
    view.dispatch({ changes: { from: target.from, to: target.to, insert: code } });
    view.focus();
    return true;
  }

  function insertImage(image: string) {
    const view = editorRef.current;
    if (!view) return;
    view.dispatch(view.state.replaceSelection(`\\includegraphics[width=0.8\\textwidth]{${image}}`));
    view.focus();
  }

  function moveToLine(view: EditorView, line: number) {
    const { from } = view.state.doc.line(Math.min(line, view.state.doc.lines));
    view.dispatch({ selection: { anchor: from }, scrollIntoView: true });
    view.focus();
  }

  async function jumpTo(file: string, line: number) {
    const view = editorRef.current;
    if (file === project.activeFile) {
      if (view) moveToLine(view, line);
      return;
    }
    pendingJumpRef.current = { file, line };
    await project.selectFile(file);
  }

  // A jump into another file has to wait until the editor shows that file.
  useEffect(() => {
    const pending = pendingJumpRef.current;
    const view = editorRef.current;
    if (!pending || !view || pending.file !== project.activeFile) return;
    if (view.state.doc.toString() !== content) return;
    pendingJumpRef.current = null;
    moveToLine(view, pending.line);
  });

  async function jumpToPdfPoint(page: number, x: number, y: number) {
    const mainFile = project.project?.mainFile;
    if (!mainFile) return;
    const source = await getDesktopApi()?.locateSource(mainFile, page, x, y);
    if (source) await jumpTo(source.file, source.line);
  }

  if (!project.isOpen) {
    return (
      <ProjectHome
        error={project.error}
        onNew={project.newDocument}
        onCreateFromTemplate={project.createFromTemplate}
        onOpenFolder={project.openFolder}
        onOpenFile={project.openFile}
        onImportZip={project.importZip}
        onOpenRecent={project.openRecent}
      />
    );
  }

  const error = project.error ?? (renderFailed ? t("pdfFailed") : null);

  return (
    <div className="flex h-full flex-col">
      {error && (
        <p role="alert" className="border-b border-line px-4 py-1 text-xs text-red-400">
          {error}
        </p>
      )}
      <main className="flex min-h-0 flex-1">
        <ProjectSidebar
          chat={
            <ChatPanel
              projectName={project.project?.name ?? null}
              getContext={getEditorContext}
              getTarget={getEditTarget}
              onCreateFile={project.createFile}
              onApply={applyToEditor}
            />
          }
          name={project.project?.name ?? t("newProject")}
          files={project.project?.files ?? [project.activeFile]}
          activeFile={project.activeFile}
          mainFile={project.project?.mainFile ?? null}
          outline={project.outline}
          onBack={project.close}
          canSave={!project.project}
          onSaveAs={saveAs}
          onSelectFile={project.selectFile}
          images={project.images}
          folders={project.folders}
          onInsertImage={insertImage}
          onCreateFile={project.createFile}
          onCreateFolder={project.createFolder}
          onAddImages={project.addImages}
          onRestoreCheckpoint={project.restoreCheckpoint}
          onSelectOutline={jumpTo}
        />
        <div ref={panesRef} className="flex min-h-0 min-w-0 flex-1">
        <section style={{ width: `${editorShare * 100}%` }} className="flex min-h-0 min-w-0 shrink-0 flex-col bg-black">
          <PaneHeader
            title={
              <div role="tablist" className="flex gap-1 overflow-x-auto">
                {project.openFiles.map((file) => (
                  <span
                    key={file}
                    className={`flex shrink-0 items-center gap-1 rounded px-2 py-0.5 ${
                      file === project.activeFile ? "bg-surface text-foreground" : ""
                    }`}
                  >
                    <button type="button" role="tab" aria-selected={file === project.activeFile} onClick={() => project.selectFile(file)}>
                      {file.split("/").pop()}
                      {file === project.activeFile && project.isDirty ? " •" : ""}
                    </button>
                    {project.openFiles.length > 1 && (
                      <button
                        type="button"
                        aria-label={t("closeTab", { file })}
                        onClick={() => project.closeFile(file)}
                        className="hover:text-accent"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            }
          >
            <button
              type="button"
              aria-label={t("smallerFont")}
              disabled={fontSize <= MIN_FONT_SIZE}
              onClick={() => changeFontSize(fontSize - 1)}
              className="px-2 hover:text-accent disabled:opacity-40"
            >
              A−
            </button>
            <span className="w-6 text-center">{fontSize}</span>
            <button
              type="button"
              aria-label={t("largerFont")}
              disabled={fontSize >= MAX_FONT_SIZE}
              onClick={() => changeFontSize(fontSize + 1)}
              className="px-2 hover:text-accent disabled:opacity-40"
            >
              A+
            </button>
          </PaneHeader>
          <div className="min-h-0 flex-1">
            <LatexEditor value={content} onChange={project.setContent} onReady={onEditorReady} fontSize={fontSize} />
          </div>
        </section>
        <div
          role="separator"
          aria-orientation="vertical"
          title={t("resizeHint")}
          onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
          onPointerMove={dragSplitter}
          onPointerUp={finishSplitterDrag}
          className="w-1 shrink-0 cursor-col-resize touch-none bg-line hover:bg-accent"
        />
        <section className="min-h-0 min-w-0 flex-1">
          <PdfPreview
            result={project.compileResult}
            layoutVersion={layoutVersion}
            onRenderError={onRenderError}
            engine={project.engine}
            onEngineChange={project.setEngine}
            isCompiling={project.isCompiling}
            compileProgress={project.compileProgress}
            onCompile={startCompile}
            onCancelCompile={project.cancelCompile}
            onSavePdf={() => {
              const mainFile = project.project?.mainFile;
              if (mainFile) getDesktopApi()?.savePdf(mainFile);
            }}
            onSelectError={jumpTo}
            onSelectPdfPoint={jumpToPdfPoint}
            autoCompile={autoCompile}
            onAutoCompileChange={changeAutoCompile}
          />
        </section>
        </div>
      </main>
    </div>
  );
}
