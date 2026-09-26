import { ArrowDownRight, ArrowRight, ArrowUpRight } from "@phosphor-icons/react";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { useCountUp } from "@/lib/motion";
import { ProgressBar, Sparkline } from "./charts";

export interface Delta {
  readonly text: string;
  readonly direction: "up" | "down" | "flat";
  readonly good: boolean | null;
}

export interface Kpi {
  readonly label: string;
  readonly value: number;
  readonly format: (value: number) => string;
  readonly suffix?: ReactNode;
  readonly hint?: ReactNode;
  readonly delta?: Delta | null;
  readonly trend?: readonly number[];
  readonly trendColor?: string;
  readonly progress?: number;
  readonly valueClassName?: string;
}

export function deltaOf(change: number, text: string, higherIsBetter: boolean | null): Delta {
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const good = higherIsBetter === null || change === 0 ? null : (change > 0) === higherIsBetter;
  return { text, direction, good };
}

export function DeltaChip({ delta }: { delta: Delta }) {
  const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : ArrowRight;
  return (
    <span className={clsx("inline-flex h-5 shrink-0 items-center gap-0.5 rounded-[4px] px-1.5 text-[11.5px] font-semibold tabular-nums", delta.good === null ? "bg-surface-2 text-muted" : delta.good ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
      <Icon size={11} weight="bold" />
      {delta.text}
    </span>
  );
}

function KpiCard({ item }: { item: Kpi }) {
  const shown = useCountUp(item.value);
  return (
    <div className="card flex min-w-0 flex-col px-5 pt-5 pb-4">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <span className="label-caps truncate">{item.label}</span>
        {item.delta && <DeltaChip delta={item.delta} />}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5 whitespace-nowrap">
        <span className={clsx("text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums", item.valueClassName)}>{item.format(shown)}</span>
        {item.suffix && <span className="text-[14px] font-medium text-muted tabular-nums">{item.suffix}</span>}
      </div>
      {item.hint && <div className="mt-2 text-[12.5px] leading-snug text-muted">{item.hint}</div>}
      <div className="mt-auto pt-4">
        {item.trend && item.trend.length >= 2 ? (
          <Sparkline points={item.trend} {...(item.trendColor ? { color: item.trendColor } : {})} height={34} />
        ) : item.progress !== undefined ? (
          <ProgressBar value={item.progress} />
        ) : null}
      </div>
    </div>
  );
}

export function KpiGrid({ items }: { items: readonly Kpi[] }) {
  return (
    <div className="no-enter @container">
      <div className="stagger grid grid-cols-2 gap-5 @min-[880px]:grid-cols-4">
        {items.map((item) => <KpiCard key={item.label} item={item} />)}
      </div>
    </div>
  );
}

export const formatCount = (value: number): string => String(Math.round(value));
