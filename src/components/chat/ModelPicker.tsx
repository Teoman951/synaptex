"use client";

import { useCallback, useEffect, useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import type { AiModel, CatalogModel, DownloadProgress, ModelOverview } from "@/types/desktop";

function formatSize(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function ModelPicker() {
  const [overview, setOverview] = useState<ModelOverview | null>(null);
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState(false);

  const load = useCallback(async () => {
    const next = await getDesktopApi()?.listModels();
    if (next) setOverview(next);
    setCatalog((await getDesktopApi()?.modelCatalog()) ?? []);
  }, []);

  useEffect(() => {
    // load only sets state after awaiting the main process.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return getDesktopApi()?.onDownloadProgress(setProgress);
  }, [load]);

  async function update(action: () => Promise<unknown> | undefined) {
    await action();
    await load();
  }

  async function download(model: CatalogModel) {
    const size = formatSize(model.bytes);
    if (!window.confirm(`${model.name} (${size}) herunterladen?`)) return;
    setDownloadError(false);
    setProgress({ label: model.name, percent: 0 });
    try {
      await update(() => getDesktopApi()?.downloadModel(model.id));
    } catch {
      setDownloadError(true);
    }
    setProgress(null);
  }

  async function installServer() {
    setDownloadError(false);
    setProgress({ label: "llama.cpp", percent: 0 });
    try {
      await update(() => getDesktopApi()?.installServer());
    } catch {
      setDownloadError(true);
    }
    setProgress(null);
  }

  function trash(model: AiModel) {
    if (!window.confirm(`„${model.name}“ in den Papierkorb verschieben?`)) return;
    return update(() => getDesktopApi()?.trashModel(model.id));
  }

  if (!overview) return null;
  const active = overview.models.find((model) => model.id === overview.activeId);
  const api = getDesktopApi();

  return (
    <div className="max-w-2xl p-4 text-xs">
      <p className="py-2 text-muted">Aktiv: <span className="text-foreground">{active?.name ?? "Keines ausgewählt"}</span></p>
      {(
        <div>
          {overview.models.length === 0 && <p className="py-2 text-muted">Keine Modelle gefunden.</p>}
          {overview.models.map((model) => (
            <div key={model.id} className="flex items-center gap-2 py-1">
              <button
                type="button"
                title={model.name}
                onClick={() => update(() => api?.selectModel(model.id))}
                className={`min-w-0 flex-1 truncate text-left hover:text-accent ${
                  model.id === overview.activeId ? "text-accent" : ""
                }`}
              >
                {model.name}
              </button>
              <span className="shrink-0 text-muted">
                {model.source}, {formatSize(model.bytes)}
              </span>
              {model.source === "Hinzugefügt" && (
                <button
                  type="button"
                  title="Aus der Liste entfernen, die Datei bleibt"
                  onClick={() => update(() => api?.removeModel(model.id))}
                  className="shrink-0 text-muted hover:text-accent"
                >
                  Entfernen
                </button>
              )}
              {model.source !== "Ollama" && (
                <button
                  type="button"
                  aria-label={`${model.name} in den Papierkorb`}
                  title="Datei in den Papierkorb verschieben"
                  onClick={() => trash(model)}
                  className="shrink-0 text-muted hover:text-red-400"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {catalog.length > 0 && <p className="mt-2 text-muted">Herunterladen</p>}
          {catalog.map((model) => (
            <div key={model.id} className="flex items-center gap-2 py-1">
              <span className="min-w-0 flex-1 truncate">{model.name}</span>
              <span className="shrink-0 text-muted">{formatSize(model.bytes)}</span>
              <button
                type="button"
                disabled={progress !== null}
                onClick={() => download(model)}
                className="shrink-0 text-accent hover:underline disabled:opacity-40"
              >
                Laden
              </button>
            </div>
          ))}
          {progress && (
            <p className="py-1">
              {progress.label}: {progress.percent} %{" "}
              <button type="button" onClick={() => api?.cancelDownload()} className="text-accent hover:underline">
                Abbrechen
              </button>
            </p>
          )}
          {downloadError && <p role="alert" className="py-1 text-red-400">Download fehlgeschlagen oder abgebrochen.</p>}
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => update(() => api?.addModel())} className="text-accent hover:underline">
              + Modell hinzufügen
            </button>
            <button type="button" onClick={() => update(() => api?.pickServer())} className="text-accent hover:underline">
              {overview.hasServer ? "llama-server ändern" : "Vorhandenen llama-server wählen"}
            </button>
            {!overview.hasServer && (
              <button
                type="button"
                disabled={progress !== null}
                onClick={installServer}
                className="text-accent hover:underline disabled:opacity-40"
              >
                llama-server einrichten
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
