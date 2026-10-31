export function PaneHeader({ title }: { title: string }) {
  return (
    <div className="flex h-8 shrink-0 items-center border-b border-line px-4 text-xs text-muted">
      {title}
    </div>
  );
}
