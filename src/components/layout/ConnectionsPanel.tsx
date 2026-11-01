"use client";

import { useCallback, useEffect, useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import { language, t } from "@/lib/i18n";
import type { McpState } from "@/types/desktop";

const timeFormat = new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" });

export function ConnectionsPanel() {
  const [state, setState] = useState<McpState | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const next = await getDesktopApi()?.mcpState();
    if (next) setState(next);
  }, []);

  useEffect(() => {
    // load only sets state after awaiting the main process.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function update(action: () => Promise<unknown> | undefined) {
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    }
    await load();
  }

  if (!state) return null;
  const api = getDesktopApi();

  return (
    <div className="max-w-2xl p-4 text-xs">
      <p className="mb-3 text-muted">{t("mcpIntro")}</p>
      <button
        type="button"
        onClick={() => update(() => (state.connected ? api?.mcpDisconnect() : api?.mcpConnect()))}
        className="rounded bg-accent px-3 py-1.5 font-medium text-canvas"
      >
        {t(state.connected ? "mcpDisconnect" : "mcpConnect")}
      </button>
      {state.connected && <p className="mt-2 text-muted">{t("mcpRestart")}</p>}
      {failed && <p role="alert" className="mt-2 text-red-400">{t("mcpFailed")}</p>}

      <h2 className="mt-6 mb-2 font-medium">{t("mcpShared")}</h2>
      {state.projects.length === 0 && <p className="text-muted">{t("noProjects")}</p>}
      {state.projects.map((project) => (
        <label key={project.id} className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={project.shared}
            onChange={(event) => update(() => api?.mcpShare(project.id, event.target.checked))}
            className="accent-accent"
          />
          {project.name}
        </label>
      ))}

      <h2 className="mt-6 mb-2 font-medium">{t("mcpLog")}</h2>
      {state.log.length === 0 && <p className="text-muted">{t("mcpNoLog")}</p>}
      {state.log.map((entry, index) => (
        <p key={index} className="text-muted">
          {timeFormat.format(entry.at)}: {entry.tool} {entry.project ?? ""} {entry.file ?? ""}
        </p>
      ))}
    </div>
  );
}
