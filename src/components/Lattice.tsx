export function Lattice({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g
        fill="none"
        stroke="url(#legendsStroke)"
        strokeWidth="1"
        opacity="0.28"
      >
        <path d="M0 800 L400 120 L800 800" />
        <path d="M200 800 L600 40 L1000 800" />
        <path d="M400 800 L800 80 L1200 800" />
        <path d="M0 500 L600 40 L1200 500" />
        <path d="M0 700 L600 200 L1200 700" />
        <path d="M150 800 L600 160 L1050 800" />
      </g>
      <defs>
        <linearGradient id="legendsStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8e1c42" />
          <stop offset="50%" stopColor="#772964" />
          <stop offset="100%" stopColor="#ce3828" />
        </linearGradient>
      </defs>
    </svg>
  );
}
