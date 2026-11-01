"use client";

import { useCallback, useEffect, useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import { t } from "@/lib/i18n";
import type { CloudState } from "@/types/desktop";

export function CloudPanel() {
  const [state, setState] = useState<CloudState | null>(null);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  const load = useCallback(async () => {
    const next = await getDesktopApi()?.cloudState();
    if (!next) return;
    setState(next);
    setProvider(next.provider);
    setModel(next.model);
  }, []);

  useEffect(() => {
    // load only sets state after awaiting the main process.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!state) return null;
  const api = getDesktopApi();
  const current = state.providers.find((item) => item.id === provider);

  async function save() {
    await api?.cloudSave(provider, model, apiKey);
    setApiKey("");
    await load();
  }

  async function removeKey() {
    await api?.cloudRemoveKey(provider);
    await load();
  }

  async function toggle(active: boolean) {
    if (active && !window.confirm(t("cloudConfirm", { name: current?.name ?? "" }))) return;
    await api?.cloudActivate(active);
    await load();
  }

  return (
    <div className="max-w-2xl border-b border-line p-4 text-xs">
      <h2 className="mb-1 font-medium">{t("cloudTitle")}</h2>
      <p className="mb-3 text-amber-400">{t("cloudWarning")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t("cloudProvider")}
          value={provider}
          onChange={(event) => {
            const next = state.providers.find((item) => item.id === event.target.value);
            setProvider(event.target.value);
            setModel(next?.defaultModel ?? "");
          }}
          className="rounded border border-line bg-surface px-2 py-1.5"
        >
          {state.providers.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <input
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder={t("cloudModel")}
          aria-label={t("cloudModel")}
          className="rounded border border-line bg-transparent px-2 py-1.5 outline-none focus:border-accent"
        />
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={current?.hasKey ? t("cloudKeySaved") : t("cloudKey")}
          aria-label={t("cloudKey")}
          autoComplete="off"
          className="rounded border border-line bg-transparent px-2 py-1.5 outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={!model.trim()}
          onClick={save}
          className="rounded bg-accent px-3 py-1.5 font-medium text-canvas disabled:opacity-40"
        >
          {t("cloudSave")}
        </button>
        {current?.hasKey && (
          <button type="button" onClick={removeKey} className="text-muted hover:text-red-400">
            {t("cloudRemoveKey")}
          </button>
        )}
      </div>
      <label className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={state.active}
          disabled={!state.active && !current?.hasKey}
          onChange={(event) => toggle(event.target.checked)}
          className="accent-accent"
        />
        {t("cloudUse")}
      </label>
    </div>
  );
}
