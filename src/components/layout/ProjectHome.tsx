"use client";

import { useEffect, useState } from "react";
import { ModelPicker } from "@/components/chat/ModelPicker";
import { Logo } from "@/components/layout/Logo";
import { getDesktopApi } from "@/lib/desktop";
import { changeLanguage, language, LANGUAGES, type Language, t } from "@/lib/i18n";
import type { ProjectTemplate, RecentProject } from "@/types/desktop";

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
  const [view, setView] = useState<"projects" | "models" | "templates">("projects");
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);

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
              <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
                {templates
                  .filter((template) => template.category === category)
                  .map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onCreateFromTemplate(template.id)}
                      className="rounded-lg border border-line bg-surface p-4 text-left text-sm hover:border-accent"
                    >
                      {t(`template.${template.id}`)}
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </main>
      )}

      {view === "models" && (
        <main className="min-w-0 flex-1 overflow-auto bg-surface/40">
          <h1 className="border-b border-line p-4 text-base font-semibold">{t("aiModels")}</h1>
          <ModelPicker />
        </main>
      )}

      {view === "projects" && (
      <main className="flex min-w-0 flex-1 flex-col bg-surface/40">
        <header className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <h1 className="mr-auto text-base font-semibold">{t("yourProjects")}</h1>
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
          {visible.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onOpenRecent(project.id)}
              className="flex w-full items-center gap-4 border-b border-line px-4 py-2 text-left text-sm hover:bg-surface"
            >
              {project.thumbnail ? (
                // A local data URL, so next/image has nothing to optimize.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={project.thumbnail} alt="" className="h-10 w-7 shrink-0 rounded-sm bg-white object-cover object-top" />
              ) : (
                <span aria-hidden className="h-10 w-7 shrink-0 rounded-sm bg-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              <span className="text-xs text-muted">{dateFormat.format(project.openedAt)}</span>
            </button>
          ))}
        </div>
      </main>
      )}
    </div>
  );
}
