export function CheckMark({ size = 12, className, animate = false }: { size?: number; className?: string; animate?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path className={animate ? "check-draw" : undefined} pathLength={1} d="M3.5 8.5 6.6 11.5 12.5 4.8" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
