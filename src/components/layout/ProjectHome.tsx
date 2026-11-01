"use client";

import { useEffect, useState } from "react";
import { CloudPanel } from "@/components/chat/CloudPanel";
import { ModelPicker } from "@/components/chat/ModelPicker";
import { ConnectionsPanel } from "@/components/layout/ConnectionsPanel";
import { Logo } from "@/components/layout/Logo";
import { getDesktopApi } from "@/lib/desktop";
import { changeLanguage, language, LANGUAGES, type Language, t } from "@/lib/i18n";
import type { ProjectTemplate, RecentProject } from "@/types/desktop";

const CARD_SIZES = { S: 140, M: 200, L: 280 };
const CARD_SIZE_KEY = "synaptex.cardSize";
const LIST_VIEW_KEY = "synaptex.listView";
type CardSize = keyof typeof CARD_SIZES;

function readCardSize(): CardSize {
  try {
    const stored = window.localStorage.getItem(CARD_SIZE_KEY);
    return stored === "S" || stored === "L" ? stored : "M";
  } catch {
    return "M";
  }
}

function readListView() {
  try {
    return window.localStorage.getItem(LIST_VIEW_KEY) === "true";
  } catch {
    return false;
  }
}

const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: "medium" });

interface ProjectHomeProps {
  error: string | null;
  onNew: () => void;
  onCreateFromTemplate: (id: string) => void;
  onOpenFolder: () => void;
  onOpenFile: () => void;
  onImportZip: () => void;
  onOpenRecent: (id: string) => void;
}

export function ProjectHome({
  error,
  onNew,
  onCreateFromTemplate,
  onOpenFolder,
  onOpenFile,
  onImportZip,
  onOpenRecent,
}: ProjectHomeProps) {
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"projects" | "models" | "connections" | "templates">("projects");
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [cardSize, setCardSize] = useState(readCardSize);
  const [listView, setListView] = useState(readListView);
  const [menuId, setMenuId] = useState<string | null>(null);
  const gridStyle = {
    gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_SIZES[cardSize]}px, 1fr))`,
  };

  function toggleListView() {
    setListView(!listView);
    try {
      window.localStorage.setItem(LIST_VIEW_KEY, String(!listView));
    } catch {
      // The view still applies for this session.
    }
  }

  function changeCardSize(next: CardSize) {
    setCardSize(next);
    try {
      window.localStorage.setItem(CARD_SIZE_KEY, next);
    } catch {
      // The size still applies for this session.
    }
  }

  const sizePicker = (
    <div role="group" aria-label={t("previewSize")} className="flex overflow-hidden rounded-full bg-surface">
      {(Object.keys(CARD_SIZES) as CardSize[]).map((size) => (
        <button
          key={size}
          type="button"
          aria-pressed={size === cardSize}
          onClick={() => changeCardSize(size)}
          className={`px-2.5 py-1.5 text-xs ${size === cardSize ? "bg-foreground text-canvas" : "text-muted hover:text-accent"}`}
        >
          {size}
        </button>
      ))}
    </div>
  );

  useEffect(() => {
    getDesktopApi()?.recentProjects().then(setProjects);
    getDesktopApi()?.listTemplates().then(setTemplates);
  }, []);

  const visible = projects.filter((project) =>
    project.name.toLowerCase().includes(query.toLowerCase()),
  );
  const secondaryActions = [
    { label: t("importZip"), onClick: onImportZip },
    { label: t("openFolder"), onClick: onOpenFolder },
    { label: t("openFile"), onClick: onOpenFile },
  ];

  return (
    <div className="flex h-full">
      <aside className="flex w-48 shrink-0 flex-col p-4">
        <Logo />
        <nav className="mt-8 flex flex-col gap-1">
          {(
            [
              { id: "projects", label: t("yourProjects") },
              { id: "models", label: t("aiModels") },
              { id: "connections", label: t("aiConnections") },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`rounded-lg px-3 py-2 text-left text-xs ${view === id ? "bg-surface" : "text-muted hover:text-accent"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <select
          aria-label={t("language")}
          value={language}
          onChange={(event) => changeLanguage(event.target.value as Language)}
          className="mt-auto rounded border border-line bg-surface px-2 py-1.5 text-xs"
        >
          {LANGUAGES.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </aside>

      {view === "templates" && (
        <main className="min-w-0 flex-1 overflow-auto bg-surface/40">
          <header className="flex items-center gap-3 border-b border-line p-4">
            <h1 className="mr-auto text-base font-semibold">{t("newProject")}</h1>
            {sizePicker}
            <button type="button" onClick={onNew} className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium hover:text-accent">
              {t("emptyDocument")}
            </button>
            <button type="button" onClick={() => setView("projects")} className="text-xs text-muted hover:text-accent">
              {t("cancel")}
            </button>
          </header>
          {[...new Set(templates.map((template) => template.category))].map((category) => (
            <section key={category} className="p-4">
              <h2 className="mb-2 text-xs font-medium text-muted">{t(`category.${category}`)}</h2>
              <div style={gridStyle} className="grid gap-3">
                {templates
                  .filter((template) => template.category === category)
                  .map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onCreateFromTemplate(template.id)}
                      className="overflow-hidden rounded-lg border border-line bg-surface text-left text-sm hover:border-accent"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`templates/${template.id}.png`} alt="" className="aspect-[3/4] w-full bg-white object-contain" />
                      <span className="block p-2">{t(`template.${template.id}`)}</span>
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </main>
      )}

      {view === "connections" && (
        <main className="min-w-0 flex-1 overflow-auto bg-surface/40">
          <h1 className="border-b border-line p-4 text-base font-semibold">{t("aiConnections")}</h1>
          <ConnectionsPanel />
        </main>
      )}

      {view === "models" && (
        <main className="min-w-0 flex-1 overflow-auto bg-surface/40">
          <h1 className="border-b border-line p-4 text-base font-semibold">{t("aiModels")}</h1>
          <CloudPanel />
          <ModelPicker />
        </main>
      )}

      {view === "projects" && (
      <main className="flex min-w-0 flex-1 flex-col bg-surface/40">
        <header className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <h1 className="mr-auto text-base font-semibold">{t("yourProjects")}</h1>
          <button
            type="button"
            onClick={toggleListView}
            className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium hover:text-accent"
          >
            {t(listView ? "gridView" : "listView")}
          </button>
          {!listView && sizePicker}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            aria-label={t("searchProjects")}
            className="w-48 rounded-full border border-line bg-transparent px-4 py-1.5 text-xs outline-none focus:border-accent"
          />
          {secondaryActions.map(({ label, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium hover:text-accent"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setView("templates")}
            className="rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-canvas"
          >
            {t("new")}
          </button>
        </header>

        {error && (
          <p role="alert" className="border-b border-line px-4 py-1 text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {visible.length === 0 && (
            <p className="p-8 text-center text-sm text-muted">
              {t(projects.length === 0 ? "noProjects" : "noMatches")}
            </p>
          )}
          <div style={listView ? undefined : gridStyle} className={listView ? "" : "grid gap-3 p-4"}>
            {visible.map((project) => (
              <div key={project.id} className="relative">
              <button
                type="button"
                onClick={() => onOpenRecent(project.id)}
                className={
                  listView
                    ? "flex w-full items-center gap-4 border-b border-line py-2 pr-10 pl-4 text-left text-sm hover:bg-surface"
                    : "overflow-hidden rounded-lg border border-line bg-surface text-left text-sm hover:border-accent"
                }
              >
                {project.thumbnail ? (
                  // A local data URL, so next/image has nothing to optimize.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.thumbnail} alt="" className={`bg-white object-cover object-top ${listView ? "h-12 w-9 shrink-0 rounded-sm" : "aspect-[3/4] w-full"}`} />
                ) : (
                  <span aria-hidden className={`block bg-foreground ${listView ? "h-12 w-9 shrink-0 rounded-sm" : "aspect-[3/4] w-full"}`} />
                )}
                <span className={`block truncate ${listView ? "min-w-0 flex-1" : "px-2 pt-2"}`}>{project.name}</span>
                <span className={`block text-xs text-muted ${listView ? "" : "px-2 pb-2"}`}>{dateFormat.format(project.openedAt)}</span>
              </button>
                <button
                  type="button"
                  aria-label={t("projectMenu")}
                  aria-expanded={menuId === project.id}
                  onClick={() => setMenuId(menuId === project.id ? null : project.id)}
                  className="absolute top-1 right-1 rounded bg-canvas/80 px-2 text-sm hover:text-accent"
                >
                  ⋯
                </button>
                {menuId === project.id && (
                  <div className="absolute top-8 right-1 z-10 rounded border border-line bg-surface py-1 text-xs shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(null);
                        getDesktopApi()?.exportZip(project.id);
                      }}
                      className="block w-full px-3 py-1.5 text-left whitespace-nowrap hover:text-accent"
                    >
                      {t("exportZip")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(null);
                        getDesktopApi()?.revealProject(project.id);
                      }}
                      className="block w-full px-3 py-1.5 text-left whitespace-nowrap hover:text-accent"
                    >
                      {t("showInFolder")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
      )}
    </div>
  );
}
