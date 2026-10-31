"use client";

import { useEffect, useRef, useState } from "react";
import { ENGINES } from "@/state/useProject";
import type { CompileResult, Engine } from "@/types/desktop";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

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
    await page.render({ canvas, viewport }).promise;
    pages.push(canvas);
  }

  if (!isCancelled()) container.replaceChildren(...pages);
  const pageCount = document.numPages;
  await loadingTask.destroy();
  return pageCount;
}

interface PdfPreviewProps {
  result: CompileResult | null;
  onRenderError: () => void;
  engine: Engine;
  onEngineChange: (engine: Engine) => void;
  isCompiling: boolean;
  onCompile: () => void;
}

export function PdfPreview({
  result,
  onRenderError,
  engine,
  onEngineChange,
  isCompiling,
  onCompile,
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
    renderPdf(pdf, container, zoom, () => cancelled)
      .then((count) => {
        if (!cancelled) setPageCount(count);
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
        <span className="ml-auto text-xs text-muted">
          {pdf ? `${pageCount} ${pageCount === 1 ? "Seite" : "Seiten"}` : ""}
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

      {result && result.errors.length > 0 && (
        <ul role="alert" className="max-h-40 shrink-0 overflow-auto border-b border-line p-3 font-mono text-xs text-red-400">
          {result.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <div ref={pagesRef} className="min-h-0 flex-1 overflow-auto p-4" />
      {!pdf && (
        <p className="absolute inset-x-0 top-1/2 text-center text-sm text-muted">
          {result ? "Kein PDF erzeugt." : "Noch kein PDF kompiliert."}
        </p>
      )}
    </div>
  );
}
