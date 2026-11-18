// The mark: a spanner laid across a buff job card with a punched corner.

export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect x="9" y="6" width="40" height="52" rx="2" fill="#EBDDBF" stroke="#221E19" strokeWidth="3" />
      <circle cx="18" cy="14" r="3" fill="#221E19" />
      <path d="M17 26h24M17 33h24M17 40h14" stroke="#2A4A9C" strokeWidth="3" strokeLinecap="round" />
      <g transform="rotate(-38 34 38)">
        <rect x="14" y="34" width="40" height="8" rx="4" fill="#A3ADB2" stroke="#221E19" strokeWidth="3" />
        <path d="M52 30a9 9 0 1 1 0 16l-4-4v-8z" fill="#A3ADB2" stroke="#221E19" strokeWidth="3" strokeLinejoin="round" />
        <path d="M58 34h5v8h-5" fill="#23272A" />
      </g>
    </svg>
  );
}
