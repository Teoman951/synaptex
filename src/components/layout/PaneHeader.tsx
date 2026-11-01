import type { ReactNode } from "react";

export function PaneHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex h-8 shrink-0 items-center border-b border-line px-4 text-xs text-muted">
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {children}
    </div>
  );
}
