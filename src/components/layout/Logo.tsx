export function Logo() {
  return (
    <div className="flex items-center gap-2 select-none">
      <svg aria-hidden viewBox="0 0 512 512" className="size-6">
        <defs>
          <linearGradient id="logo-background" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2563eb" />
            <stop offset="1" stopColor="#0f1b4d" />
          </linearGradient>
        </defs>
        <rect x="16" y="16" width="480" height="480" rx="104" fill="url(#logo-background)" />
        <path
          d="M352 150 C 300 104 164 112 164 192 C 164 276 348 236 348 320 C 348 400 212 408 160 362"
          fill="none"
          stroke="#ffffff"
          strokeWidth="44"
          strokeLinecap="round"
        />
        <circle cx="352" cy="150" r="44" fill="#6ee7f9" />
        <circle cx="160" cy="362" r="44" fill="#6ee7f9" />
      </svg>
      <span className="text-sm font-semibold tracking-tight">
        Synap<span className="text-accent">TeX</span>
      </span>
    </div>
  );
}
