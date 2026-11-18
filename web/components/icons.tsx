// Line icons drawn for this site: the spanner, the torque wrench, the clock, and a few small ones.

type P = { size?: number; className?: string };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export function IconSpanner({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3z" />
      <path d="M14.7 6.3 17 4l3 3-2.3 2.3" />
    </svg>
  );
}

export function IconTorque({ size = 20, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="6" cy="18" r="3" />
      <path d="m8.2 15.8 11-11" />
      <path d="m15.5 5.5 3 3" />
      <path d="M12 12.5 13.5 14" />
    </svg>
  );
}

export function IconClock({ size = 16, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconCheck({ size = 16, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

export function IconHand({ size = 16, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1V4.5a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.3 14a1.5 1.5 0 0 1 2.4-1.8L8 15" />
    </svg>
  );
}

export function IconExternal({ size = 14, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function IconWallet({ size = 16, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="6" width="18" height="13" rx="1.5" />
      <path d="M3 9h18M16 14h2" />
    </svg>
  );
}

export function IconDrop({ size = 16, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" />
    </svg>
  );
}
