export function AppIconMark({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="app-icon-bg" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#86FAF8" />
          <stop offset="0.28" stopColor="#43CFF8" />
          <stop offset="0.64" stopColor="#2D79F6" />
          <stop offset="1" stopColor="#2755D8" />
        </linearGradient>
        <linearGradient id="app-icon-glow" x1="20" y1="16" x2="48" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id="app-icon-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#2454d8" floodOpacity="0.28" />
        </filter>
      </defs>
      <g filter="url(#app-icon-shadow)">
        <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#app-icon-bg)" />
      </g>
      <circle cx="22" cy="18" r="12" fill="url(#app-icon-glow)" opacity="0.7" />
      <path
        d="M21 19.5C21 18.12 22.12 17 23.5 17H39.5C40.88 17 42 18.12 42 19.5V21.5C42 22.88 40.88 24 39.5 24H26V30H36.5C37.88 30 39 31.12 39 32.5V34.5C39 35.88 37.88 37 36.5 37H26V44.5C26 45.88 24.88 47 23.5 47H22.5C21.12 47 20 45.88 20 44.5V19.5H21Z"
        fill="white"
      />
      <rect x="43.5" y="30" width="4" height="17" rx="2" fill="white" />
      <rect x="49.5" y="25" width="4" height="22" rx="2" fill="white" />
      <rect x="37.5" y="35" width="4" height="12" rx="2" fill="white" />
    </svg>
  );
}
