"use client";

import { useCallback, useEffect, useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import type { AiModel, ModelOverview } from "@/types/desktop";

function formatSize(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

interface ModelPickerProps {
  onChange: () => void;
}

export function ModelPicker({ onChange }: ModelPickerProps) {
  const [overview, setOverview] = useState<ModelOverview | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const load = useCallback(async () => {
    const next = await getDesktopApi()?.listModels();
    if (next) setOverview(next);
  }, []);

  useEffect(() => {
    // load only sets state after awaiting the main process.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function update(action: () => Promise<unknown> | undefined) {
    await action();
    await load();
    onChange();
  }

  function trash(model: AiModel) {
    if (!window.confirm(`„${model.name}“ in den Papierkorb verschieben?`)) return;
    return update(() => getDesktopApi()?.trashModel(model.id));
  }

  if (!overview) return null;
  const active = overview.models.find((model) => model.id === overview.activeId);
  const showList = isOpen || !active || !overview.hasServer;
  const api = getDesktopApi();

  return (
    <div className="border-b border-line text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:text-accent"
      >
        <span className="text-muted">Modell</span>
        <span className="min-w-0 flex-1 truncate">{active?.name ?? "Keines ausgewählt"}</span>
        <span aria-hidden>{showList ? "▴" : "▾"}</span>
      </button>

      {showList && (
        <div className="max-h-64 overflow-auto px-3 pb-3">
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
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => update(() => api?.addModel())} className="text-accent hover:underline">
              + Modell hinzufügen
            </button>
            <button type="button" onClick={() => update(() => api?.pickServer())} className="text-accent hover:underline">
              {overview.hasServer ? "llama-server ändern" : "llama-server wählen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
