"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorView } from "@uiw/react-codemirror";
import { PaneHeader } from "@/components/layout/PaneHeader";
import { ProjectHome } from "@/components/layout/ProjectHome";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { PdfPreview } from "@/components/preview/PdfPreview";
import { parseOutline } from "@/lib/outline";
import { useProject } from "@/state/useProject";

// CodeMirror needs the DOM, so it must never render during the static export.
const LatexEditor = dynamic(() => import("@/components/editor/LatexEditor"), {
  ssr: false,
});

const AUTO_COMPILE_KEY = "synaptex.autoCompile";
const AUTO_SAVE_DELAY_MS = 1500;

function readAutoCompile() {
  try {
    return window.localStorage.getItem(AUTO_COMPILE_KEY) === "true";
  } catch {
    return false;
  }
}

export function Workspace() {
  const project = useProject();
  const { save, saveAs, content } = project;
  const [renderFailed, setRenderFailed] = useState(false);
  const [autoCompile, setAutoCompile] = useState(
    () => typeof window !== "undefined" && readAutoCompile(),
  );
  const onRenderError = useCallback(() => setRenderFailed(true), []);
  const editorRef = useRef<EditorView | null>(null);
  const onEditorReady = useCallback((view: EditorView) => {
    editorRef.current = view;
  }, []);
  const outline = useMemo(() => parseOutline(content), [content]);

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

  function jumpToLine(line: number) {
    const view = editorRef.current;
    if (!view) return;
    const { from } = view.state.doc.line(line);
    view.dispatch({ selection: { anchor: from }, scrollIntoView: true });
    view.focus();
  }

  if (!project.isOpen) {
    return (
      <ProjectHome
        error={project.error}
        onNew={project.newDocument}
        onOpenFolder={project.openFolder}
        onOpenFile={project.openFile}
        onImportZip={project.importZip}
        onOpenRecent={project.openRecent}
      />
    );
  }

  const error = project.error ?? (renderFailed ? "Das PDF konnte nicht angezeigt werden." : null);

  return (
    <div className="flex h-full flex-col">
      {error && (
        <p role="alert" className="border-b border-line px-4 py-1 text-xs text-red-400">
          {error}
        </p>
      )}
      <main className="flex min-h-0 flex-1">
        <ProjectSidebar
          name={project.project?.name ?? "Neues Projekt"}
          files={project.project?.files ?? [project.activeFile]}
          activeFile={project.activeFile}
          mainFile={project.project?.mainFile ?? null}
          outline={outline}
          onBack={project.close}
          onSave={save}
          onSaveAs={saveAs}
          onSelectFile={project.selectFile}
          onSelectOutline={jumpToLine}
        />
        <section className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-line bg-black">
          <PaneHeader title={project.isDirty ? `${project.activeFile} •` : project.activeFile} />
          <div className="min-h-0 flex-1">
            <LatexEditor value={content} onChange={project.setContent} onReady={onEditorReady} />
          </div>
        </section>
        <section className="min-h-0 min-w-0 flex-1">
          <PdfPreview
            result={project.compileResult}
            onRenderError={onRenderError}
            engine={project.engine}
            onEngineChange={project.setEngine}
            isCompiling={project.isCompiling}
            compileProgress={project.compileProgress}
            onCompile={startCompile}
            autoCompile={autoCompile}
            onAutoCompileChange={changeAutoCompile}
          />
        </section>
      </main>
    </div>
  );
}
