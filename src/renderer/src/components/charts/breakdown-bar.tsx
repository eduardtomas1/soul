import { clsx } from "clsx";
import type { ColorToken } from "@shared/contracts/common";

export interface BreakdownSegment {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly tone: ColorToken;
}

export function BreakdownBar({ segments, format, height = 10, className }: { segments: readonly BreakdownSegment[]; format: (value: number) => string; height?: number; className?: string }) {
  const visible = segments.filter((segment) => segment.value > 0);
  return (
    <div className={clsx("reveal-x flex w-full gap-[2px] overflow-hidden rounded-[3px] bg-surface-3", className)} style={{ height }} role="img" aria-label={visible.map((segment) => `${segment.label} ${format(segment.value)}`).join(", ")}>
      {visible.map((segment) => (
        <div key={segment.key} className={`tone-${segment.tone}`} style={{ flexGrow: segment.value, flexBasis: 0, background: "var(--tone)" }} title={`${segment.label} · ${format(segment.value)}`} />
      ))}
    </div>
  );
}
