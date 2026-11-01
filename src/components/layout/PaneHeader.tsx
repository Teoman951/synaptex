import type { ReactNode } from "react";

export function PaneHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-8 shrink-0 items-center border-b border-line px-4 text-xs text-muted">
      <div className="min-w-0 flex-1 truncate">{title}</div>
      {children}
    </div>
  );
}
