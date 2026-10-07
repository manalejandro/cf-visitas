export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="visitas-mark" x1="96" y1="96" x2="416" y2="416" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#visitas-mark)" />
      <rect x="128" y="272" width="64" height="112" rx="32" fill="#fff" fillOpacity="0.88" />
      <rect x="224" y="208" width="64" height="176" rx="32" fill="#fff" fillOpacity="0.95" />
      <rect x="320" y="144" width="64" height="240" rx="32" fill="#fff" />
      <circle cx="352" cy="104" r="20" fill="#fff" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-8" />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-bold tracking-tight text-strong">Visitas</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-faint">Web Analytics</span>
      </span>
    </span>
  );
}
