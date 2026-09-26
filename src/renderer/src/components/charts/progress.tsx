import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { ColorToken } from "@shared/contracts/common";

export function ProgressRing({ value, size = 44, stroke = 4, tone, color, children, className }: { value: number; size?: number; stroke?: number; tone?: ColorToken; color?: string; children?: ReactNode; className?: string }) {
  const radius = (size - stroke) / 2;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <span className={clsx("relative inline-flex shrink-0 items-center justify-center", tone && `tone-${tone}`, className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {clamped > 0 && <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color ?? (tone ? "var(--tone)" : "var(--signal)")}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - clamped}
        />}
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  );
}

export function ProgressBar({ value, tone, className, height = 6, over, color }: { value: number; tone?: ColorToken; className?: string; height?: number; over?: boolean; color?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={clsx("overflow-hidden rounded-full bg-surface-3", tone && `tone-${tone}`, className)} style={{ height }} role="presentation">
      <div className="bar-progress h-full rounded-full" style={{ transform: `scaleX(${clamped})`, background: over ? "var(--danger)" : color ?? (tone ? "var(--tone)" : "var(--signal)") }} />
    </div>
  );
}
