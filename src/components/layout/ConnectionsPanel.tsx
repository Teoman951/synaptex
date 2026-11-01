"use client";

import { useCallback, useEffect, useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import { language, t } from "@/lib/i18n";
import { diffLines } from "@/lib/lineDiff";
import type { McpProposal, McpState } from "@/types/desktop";

const PROPOSAL_POLL_MS = 3000;

const timeFormat = new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" });

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1" title={value}>
        {value}
      </code>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(value)}
        className="shrink-0 text-accent hover:underline"
      >
        {t("copy")}
      </button>
    </div>
  );
}

export function ConnectionsPanel() {
  const [state, setState] = useState<McpState | null>(null);
  const [failed, setFailed] = useState(false);
  const [proposals, setProposals] = useState<McpProposal[]>([]);

  const loadProposals = useCallback(async () => {
    const next = await getDesktopApi()?.mcpProposals();
    if (next) setProposals(next);
  }, []);

  // Proposals arrive from another program, so there is no event to wait for.
  useEffect(() => {
    const timer = setInterval(loadProposals, PROPOSAL_POLL_MS);
    return () => clearInterval(timer);
  }, [loadProposals]);

  const load = useCallback(async () => {
    const next = await getDesktopApi()?.mcpState();
    if (next) setState(next);
    await loadProposals();
  }, [loadProposals]);

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
  const lastAccess = state.log[0];
  const statusText = !state.connected
    ? t("mcpOff")
    : lastAccess
      ? t("mcpActive", { time: timeFormat.format(lastAccess.at) })
      : t("mcpWaiting");
  const statusColor = !state.connected ? "bg-muted" : lastAccess ? "bg-green-500" : "bg-amber-400";

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
      <p className="mt-3 flex items-center gap-2">
        <span aria-hidden className={`size-2 rounded-full ${statusColor}`} />
        {statusText}
      </p>
      {state.connected && <p className="mt-2 text-muted">{t("mcpRestart")}</p>}
      {failed && <p role="alert" className="mt-2 text-red-400">{t("mcpFailed")}</p>}

      <h2 className="mt-6 mb-1 font-medium">{t("chatgptTitle")}</h2>
      <p className="mb-2 text-muted">{t("chatgptHint")}</p>
      <CopyField label="Name" value="synaptex" />
      <CopyField label={t("chatgptCommand")} value={state.server.command} />
      {state.server.args.map((arg, index) => (
        <CopyField key={arg} label={`${t("chatgptArgument")} ${index + 1}`} value={arg} />
      ))}
      <CopyField label={t("chatgptEnvKey")} value="ELECTRON_RUN_AS_NODE" />
      <CopyField label={t("chatgptEnvValue")} value="1" />

      <h2 className="mt-6 mb-2 font-medium">{t("mcpProposals")}</h2>
      {proposals.length === 0 && <p className="text-muted">{t("mcpNoProposals")}</p>}
      {proposals.map((proposal) => (
        <div key={proposal.id} className="mb-3 rounded border border-line p-2">
          <p className="font-medium">
            {proposal.project}: {proposal.file}
          </p>
          {proposal.reason && <p className="text-muted">{proposal.reason}</p>}
          <pre className="my-2 max-h-48 overflow-auto font-mono text-[11px]">
            {diffLines(proposal.oldText, proposal.newText).map((line, index) => (
              <div
                key={index}
                className={
                  line.type === "added"
                    ? "bg-green-500/15 text-green-300"
                    : line.type === "removed"
                      ? "bg-red-500/15 text-red-300"
                      : "text-muted"
                }
              >
                {line.text}
              </div>
            ))}
          </pre>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => update(() => api?.mcpApprove(proposal.id))}
              className="rounded bg-accent px-2 py-1 font-medium text-canvas"
            >
              {t("apply")}
            </button>
            <button
              type="button"
              onClick={() => update(() => api?.mcpReject(proposal.id))}
              className="text-muted hover:text-accent"
            >
              {t("reject")}
            </button>
          </div>
        </div>
      ))}

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
