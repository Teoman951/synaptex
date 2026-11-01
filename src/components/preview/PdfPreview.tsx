"use client";

import { useEffect, useRef, useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import { hintFor } from "@/lib/latexErrorHints";
import { ENGINES } from "@/state/useProject";
import type { CompileError, CompileResult, Engine } from "@/types/desktop";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const THUMBNAIL_WIDTH = 120;

function saveThumbnail(page: HTMLCanvasElement) {
  const thumbnail = window.document.createElement("canvas");
  thumbnail.width = THUMBNAIL_WIDTH;
  thumbnail.height = (page.height / page.width) * THUMBNAIL_WIDTH;
  thumbnail.getContext("2d")?.drawImage(page, 0, 0, thumbnail.width, thumbnail.height);
  return getDesktopApi()?.saveThumbnail(thumbnail.toDataURL("image/jpeg", 0.7));
}

// The pdf.js worker is shared, and overlapping documents can stall it.
let renderQueue: Promise<number | null> = Promise.resolve(null);

async function renderPdf(
  data: Uint8Array,
  container: HTMLElement,
  zoom: number,
  isCancelled: () => boolean,
) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(
    new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
    { type: "module" },
  );

  // pdf.js takes ownership of the buffer, so it gets a copy.
  const loadingTask = pdfjs.getDocument({ data: data.slice() });
  const document = await loadingTask.promise;
  const pages: HTMLCanvasElement[] = [];
  // Leaves room for padding and the scrollbar that appears with the pages.
  const width = (container.clientWidth - 48) * zoom;

  for (let number = 1; number <= document.numPages && !isCancelled(); number++) {
    const page = await document.getPage(number);
    const scale = width / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale: scale * window.devicePixelRatio });

    const canvas = window.document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${width}px`;
    canvas.className = "mx-auto mb-4 max-w-none rounded-sm bg-white";
    canvas.dataset.page = String(number);
    canvas.dataset.pointWidth = String(page.getViewport({ scale: 1 }).width);
    await page.render({ canvas, viewport }).promise;
    pages.push(canvas);
  }

  if (!isCancelled()) {
    container.replaceChildren(...pages);
    if (pages[0]) await saveThumbnail(pages[0]);
  }
  const pageCount = document.numPages;
  await loadingTask.destroy();
  return pageCount;
}

function ProblemItem({
  error,
  onSelect,
}: {
  error: CompileError;
  onSelect: (file: string, line: number) => void;
}) {
  const { file, line, message } = error;
  const hint = hintFor(message);
  return (
    <>
      {file === null || line === null ? (
        message
      ) : (
        <button
          type="button"
          onClick={() => onSelect(file, line)}
          className="w-full py-0.5 text-left hover:underline"
        >
          {file}:{line}: {message}
        </button>
      )}
      {hint && <p className="mb-1 font-sans text-muted">{hint}</p>}
    </>
  );
}

interface PdfPreviewProps {
  result: CompileResult | null;
  onRenderError: () => void;
  engine: Engine;
  onEngineChange: (engine: Engine) => void;
  isCompiling: boolean;
  compileProgress: string | null;
  onCompile: () => void;
  onCancelCompile: () => void;
  onSelectError: (file: string, line: number) => void;
  onSelectPdfPoint: (page: number, x: number, y: number) => void;
  autoCompile: boolean;
  onAutoCompileChange: (enabled: boolean) => void;
}

export function PdfPreview({
  result,
  onRenderError,
  engine,
  onEngineChange,
  isCompiling,
  compileProgress,
  onCompile,
  onCancelCompile,
  onSelectError,
  onSelectPdfPoint,
  autoCompile,
  onAutoCompileChange,
}: PdfPreviewProps) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const pdf = result?.pdf ?? null;

  useEffect(() => {
    const container = pagesRef.current;
    if (!container) return;
    if (!pdf) {
      container.replaceChildren();
      return;
    }
    let cancelled = false;
    const render = renderQueue.then(() =>
      cancelled ? null : renderPdf(pdf, container, zoom, () => cancelled),
    );
    renderQueue = render.catch(() => null);
    render
      .then((count) => {
        if (count !== null && !cancelled) setPageCount(count);
      })
      .catch(onRenderError);
    return () => {
      cancelled = true;
    };
  }, [pdf, zoom, onRenderError]);

  const zoomButton = "size-6 rounded text-sm hover:bg-surface disabled:opacity-40";

  return (
    <div className="relative flex h-full flex-col bg-canvas">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <button
          type="button"
          onClick={onCompile}
          disabled={isCompiling}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-canvas disabled:opacity-60"
        >
          {isCompiling ? "Kompiliert..." : "PDF kompilieren"}
        </button>
        {isCompiling && (
          <button
            type="button"
            onClick={onCancelCompile}
            className="rounded-lg border border-line px-3 py-1 text-xs hover:text-accent"
          >
            Abbrechen
          </button>
        )}
        <select
          aria-label="LaTeX-Compiler"
          value={engine}
          onChange={(event) => onEngineChange(event.target.value as Engine)}
          className="rounded border border-line bg-surface px-2 py-1 text-xs"
        >
          {ENGINES.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <label
          title="Kompiliert kurz nach der letzten Eingabe"
          className="flex items-center gap-1 text-xs text-muted"
        >
          <input
            type="checkbox"
            checked={autoCompile}
            onChange={(event) => onAutoCompileChange(event.target.checked)}
            className="accent-accent"
          />
          Auto
        </label>
        <span className="ml-auto text-xs text-muted">
          {compileProgress ?? (pdf ? `${pageCount} ${pageCount === 1 ? "Seite" : "Seiten"}` : "")}
        </span>
        <button
          type="button"
          aria-label="Verkleinern"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom(zoom - ZOOM_STEP)}
          className={zoomButton}
        >
          −
        </button>
        <span className="w-10 text-center text-xs text-muted">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          aria-label="Vergrößern"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom(zoom + ZOOM_STEP)}
          className={zoomButton}
        >
          +
        </button>
      </div>

      <div
        ref={pagesRef}
        title="Klick springt zur Stelle im Quelltext"
        onClick={(event) => {
          const { target, nativeEvent } = event;
          if (!(target instanceof HTMLCanvasElement)) return;
          const pointsPerPixel = Number(target.dataset.pointWidth) / target.clientWidth;
          onSelectPdfPoint(
            Number(target.dataset.page),
            nativeEvent.offsetX * pointsPerPixel,
            nativeEvent.offsetY * pointsPerPixel,
          );
        }}
        className="min-h-0 flex-1 overflow-auto p-4"
      />
      {result && result.errors.length > 0 && (
        <details open className="shrink-0 border-t border-line bg-surface">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-red-400">
            {result.errors.length} {result.errors.length === 1 ? "Problem" : "Probleme"}
          </summary>
          <ul role="alert" className="max-h-40 overflow-auto px-3 pb-3 font-mono text-xs text-red-400">
            {result.errors.map((error) => (
              <li key={`${error.file}:${error.line}:${error.message}`}>
                <ProblemItem error={error} onSelect={onSelectError} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {!pdf && (
        <p className="absolute inset-x-0 top-1/2 text-center text-sm text-muted">
          {result ? "Kein PDF erzeugt." : "Noch kein PDF kompiliert."}
        </p>
      )}
    </div>
  );
}
