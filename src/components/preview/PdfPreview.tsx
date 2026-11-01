"use client";

import "pdfjs-dist/web/pdf_viewer.css";
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
  // workerSrc, not workerPort: destroying a document ends a shared port.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;

  // pdf.js takes ownership of the buffer, so it gets a copy.
  const loadingTask = pdfjs.getDocument({ data: data.slice() });
  const document = await loadingTask.promise;
  const pages: HTMLDivElement[] = [];
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
    canvas.className = "block max-w-none rounded-sm bg-white";
    await page.render({ canvas, viewport }).promise;

    const wrapper = window.document.createElement("div");
    wrapper.className = "relative mx-auto mb-4";
    wrapper.style.width = `${width}px`;
    wrapper.style.setProperty("--total-scale-factor", String(scale));
    wrapper.dataset.page = String(number);
    wrapper.dataset.pointWidth = String(page.getViewport({ scale: 1 }).width);

    // Transparent text above the canvas makes the page selectable.
    const textContainer = window.document.createElement("div");
    textContainer.className = "textLayer";
    await new pdfjs.TextLayer({
      textContentSource: page.streamTextContent(),
      container: textContainer,
      viewport: page.getViewport({ scale }),
    }).render();

    wrapper.append(canvas, textContainer);
    pages.push(wrapper);
  }

  if (!isCancelled()) {
    container.replaceChildren(...pages);
    const firstPage = pages[0]?.querySelector("canvas");
    if (firstPage) await saveThumbnail(firstPage);
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
  onSavePdf: () => void;
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
  onSavePdf,
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
        {pdf && (
          <button
            type="button"
            onClick={onSavePdf}
            className="rounded-lg border border-line px-3 py-1 text-xs hover:text-accent"
          >
            PDF speichern
          </button>
        )}
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
        title="Klick springt zum Quelltext, Ziehen markiert Text"
        onClick={(event) => {
          // A drag selects text; only a plain click jumps to the source.
          if (!window.getSelection()?.isCollapsed) return;
          const page = (event.target as HTMLElement).closest<HTMLElement>("[data-page]");
          if (!page) return;
          const box = page.getBoundingClientRect();
          const pointsPerPixel = Number(page.dataset.pointWidth) / box.width;
          onSelectPdfPoint(
            Number(page.dataset.page),
            (event.clientX - box.left) * pointsPerPixel,
            (event.clientY - box.top) * pointsPerPixel,
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
