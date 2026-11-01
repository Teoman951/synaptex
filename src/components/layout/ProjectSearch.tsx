"use client";

import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import type { SearchMatch } from "@/types/desktop";

const SEARCH_DELAY_MS = 250;

interface ProjectSearchProps {
  onSelect: (file: string, line: number) => void;
}

export function ProjectSearch({ onSelect }: ProjectSearchProps) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = (await getDesktopApi()?.searchProject(query)) ?? [];
      if (!cancelled) setMatches(found);
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="p-3 text-xs">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("searchInProject")}
        aria-label={t("searchInProject")}
        className="w-full rounded border border-line bg-transparent px-2 py-1 outline-none focus:border-accent"
      />
      {query && <p className="py-2 text-muted">{t("matches", { count: matches.length })}</p>}
      {matches.map((match) => (
        <button
          key={`${match.file}:${match.line}`}
          type="button"
          title={match.text}
          onClick={() => onSelect(match.file, match.line)}
          className="block w-full border-b border-line py-1 text-left hover:text-accent"
        >
          <span className="block truncate text-muted">
            {match.file}:{match.line}
          </span>
          <span className="block truncate">{match.text}</span>
        </button>
      ))}
    </div>
  );
}
