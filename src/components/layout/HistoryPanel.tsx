"use client";

import { useEffect, useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import type { Checkpoint } from "@/types/desktop";

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "medium" });

interface HistoryPanelProps {
  onRestore: (id: string) => void;
}

export function HistoryPanel({ onRestore }: HistoryPanelProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  useEffect(() => {
    getDesktopApi()?.listCheckpoints().then(setCheckpoints);
  }, []);

  return (
    <div className="min-h-0 flex-1 overflow-auto text-xs">
      {checkpoints.length === 0 && <p className="p-3 text-muted">Noch keine Checkpoints.</p>}
      {checkpoints.map((checkpoint) => (
        <div key={checkpoint.id} className="border-b border-line px-3 py-2">
          <p>{dateFormat.format(checkpoint.createdAt)}</p>
          <p className="text-muted">
            {checkpoint.label}, {checkpoint.fileCount} Dateien
          </p>
          <button
            type="button"
            onClick={() => onRestore(checkpoint.id)}
            className="mt-1 text-accent hover:underline"
          >
            Wiederherstellen
          </button>
        </div>
      ))}
    </div>
  );
}
