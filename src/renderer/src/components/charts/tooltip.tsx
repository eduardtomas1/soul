import type { ReactNode } from "react";

export interface TooltipRow {
  readonly label: string;
  readonly value: ReactNode;
  readonly color?: string;
}

const WIDTH = 184;
const GAP = 14;

export function ChartTooltip({ x, containerWidth, title, rows }: { x: number; containerWidth: number; title: ReactNode; rows: readonly TooltipRow[] }) {
  const fitsRight = x + GAP + WIDTH <= containerWidth;
  const left = fitsRight ? x + GAP : Math.max(0, x - GAP - WIDTH);
  return (
    <div className="fade pointer-events-none absolute top-1 z-10 rounded-[8px] border border-border bg-surface px-2.5 py-2 shadow-[var(--shadow-lg)]" style={{ left, width: WIDTH }}>
      <div className="mb-1 text-[11.5px] font-semibold text-text">{title}</div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2 text-[12px] leading-5">
          {row.color && <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: row.color }} />}
          <span className="min-w-0 flex-1 truncate text-muted">{row.label}</span>
          <span className="font-medium tabular-nums text-text">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
