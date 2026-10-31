export function Logo() {
  return (
    <div className="flex items-center gap-2 select-none">
      <span
        aria-hidden
        className="flex size-6 items-center justify-center rounded bg-accent font-mono text-xs font-bold text-canvas"
      >
        S
      </span>
      <span className="text-sm font-semibold tracking-tight">
        Synap<span className="text-accent">TeX</span>
      </span>
    </div>
  );
}
