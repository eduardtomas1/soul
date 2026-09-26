import { useState, type PointerEvent } from "react";
import { axisWidth, labelIndexes, niceDomain } from "./scale";
import { ChartTooltip } from "./tooltip";
import { useWidth } from "./use-width";

export interface ColumnSeries {
  readonly name: string;
  readonly color: string;
  readonly values: readonly number[];
  readonly colorFor?: (value: number, index: number) => string;
}

interface ColumnChartProps {
  readonly labels: readonly string[];
  readonly titles?: readonly string[];
  readonly series: readonly ColumnSeries[];
  readonly format: (value: number) => string;
  readonly formatAxis?: (value: number) => string;
  readonly height?: number;
  readonly reference?: { readonly value: number; readonly label: string } | null;
  readonly max?: number;
  readonly axisStep?: number;
  readonly ariaLabel: string;
}

const TOP = 14;
const BOTTOM = 26;
const RIGHT = 6;

export function ColumnChart({ labels, titles, series, format, formatAxis, height = 200, reference = null, max, axisStep = 0, ariaLabel }: ColumnChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const values = series.flatMap((entry) => [...entry.values]);
  if (reference) values.push(reference.value);
  if (max !== undefined) values.push(max);
  const domain = niceDomain(values, 4, true, axisStep);
  const axis = domain.ticks.map(formatAxis ?? format);
  const left = axisWidth(axis);
  const innerWidth = Math.max(1, width - left - RIGHT);
  const innerHeight = height - TOP - BOTTOM;
  const count = labels.length;
  const slot = innerWidth / Math.max(1, count);
  const group = Math.min(slot * 0.72, 18 * series.length + 4 * (series.length - 1));
  const gap = series.length > 1 ? Math.min(3, group * 0.08) : 0;
  const bar = Math.max(1, (group - gap * (series.length - 1)) / series.length);
  const y = (value: number) => TOP + innerHeight - ((value - domain.min) / (domain.max - domain.min || 1)) * innerHeight;
  const zero = y(0);

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - bounds.left - left) / slot);
    setHover(index >= 0 && index < count ? index : null);
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block">
          {domain.ticks.map((tick, index) => (
            <g key={tick}>
              <line x1={left} x2={left + innerWidth} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeDasharray={tick === 0 ? undefined : "2 4"} />
              <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-[var(--faint)] text-[10.5px] tabular-nums">{axis[index]}</text>
            </g>
          ))}
          {hover !== null && <rect x={left + hover * slot} y={TOP} width={slot} height={innerHeight} fill="var(--surface-2)" />}
          {labels.map((label, index) => {
            const start = left + index * slot + (slot - group) / 2;
            return (
              <g key={`${label}-${index}`}>
                {series.map((entry, seriesIndex) => {
                  const value = entry.values[index] ?? 0;
                  const top = y(Math.max(0, value));
                  const bottom = y(Math.min(0, value));
                  const barHeight = Math.max(value === 0 ? 0 : 1.5, bottom - top);
                  return (
                    <rect
                      key={entry.name}
                      className="grow-y"
                      style={{ animationDelay: `${Math.min(index * 14, 420)}ms` }}
                      x={start + seriesIndex * (bar + gap)}
                      y={value < 0 ? zero : zero - barHeight}
                      width={bar}
                      height={barHeight}
                      rx={Math.min(2, bar / 2)}
                      fill={entry.colorFor ? entry.colorFor(value, index) : entry.color}
                    />
                  );
                })}
              </g>
            );
          })}
          {reference && (
            <g>
              <line x1={left} x2={left + innerWidth} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--muted)" strokeDasharray="5 4" />
              <text x={left + innerWidth} y={y(reference.value) - 5} textAnchor="end" className="fill-[var(--muted)] text-[10.5px] font-medium">{reference.label}</text>
            </g>
          )}
          {labelIndexes(count, Math.max(2, Math.floor(innerWidth / 64))).map((index) => {
            const center = left + index * slot + slot / 2;
            const half = ((labels[index] ?? "").length * 5.8) / 2;
            const anchor = center + half > width ? "end" : center - half < 0 ? "start" : "middle";
            return <text key={index} x={anchor === "end" ? width : anchor === "start" ? 0 : center} y={height - 8} textAnchor={anchor} className="fill-[var(--faint)] text-[10.5px]">{labels[index]}</text>;
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <ChartTooltip
          x={left + hover * slot + slot / 2}
          containerWidth={width}
          title={titles?.[hover] ?? labels[hover]}
          rows={series.map((entry) => ({ label: entry.name, color: entry.color, value: format(entry.values[hover] ?? 0) }))}
        />
      )}
    </div>
  );
}
