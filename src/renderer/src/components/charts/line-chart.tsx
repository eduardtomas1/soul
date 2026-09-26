import { useId, useState, type PointerEvent } from "react";
import { axisWidth, labelIndexes, niceDomain } from "./scale";
import { ChartTooltip } from "./tooltip";
import { useWidth } from "./use-width";

export interface LineSeries {
  readonly name: string;
  readonly color: string;
  readonly values: ReadonlyArray<number | null>;
  readonly area?: boolean;
  readonly connectGaps?: boolean;
}

interface LineChartProps {
  readonly labels: readonly string[];
  readonly titles?: readonly string[];
  readonly series: readonly LineSeries[];
  readonly format: (value: number) => string;
  readonly formatAxis?: (value: number) => string;
  readonly height?: number;
  readonly target?: { readonly value: number; readonly label: string } | null;
  readonly includeZero?: boolean;
  readonly domain?: { readonly min: number; readonly max: number };
  readonly axisStep?: number;
  readonly ariaLabel: string;
}

const TOP = 14;
const BOTTOM = 26;
const RIGHT = 14;

function segments(values: ReadonlyArray<number | null>, connectGaps = false): Array<Array<{ index: number; value: number }>> {
  if (connectGaps) {
    const points = values.flatMap((value, index) => (value === null ? [] : [{ index, value }]));
    return points.length > 0 ? [points] : [];
  }
  const result: Array<Array<{ index: number; value: number }>> = [];
  let current: Array<{ index: number; value: number }> = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length > 0) result.push(current);
      current = [];
    } else {
      current.push({ index, value });
    }
  });
  if (current.length > 0) result.push(current);
  return result;
}

export function LineChart({ labels, titles, series, format, formatAxis, height = 200, target = null, includeZero = false, domain: fixed, axisStep = 0, ariaLabel }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();
  const values = series.flatMap((entry) => entry.values.filter((value): value is number => value !== null));
  if (target) values.push(target.value);
  const domain = fixed ? niceDomain([fixed.min, fixed.max], 4, false, axisStep) : niceDomain(values, 4, includeZero, axisStep);
  const axis = domain.ticks.map(formatAxis ?? format);
  const left = axisWidth(axis);
  const innerWidth = Math.max(1, width - left - RIGHT);
  const innerHeight = height - TOP - BOTTOM;
  const count = labels.length;
  const x = (index: number) => left + (count <= 1 ? innerWidth / 2 : (index / (count - 1)) * innerWidth);
  const y = (value: number) => TOP + innerHeight - ((value - domain.min) / (domain.max - domain.min || 1)) * innerHeight;
  const baseline = y(Math.max(domain.min, Math.min(domain.max, 0)));

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientX - bounds.left - left;
    const index = count <= 1 ? 0 : Math.round((position / innerWidth) * (count - 1));
    setHover(Math.max(0, Math.min(count - 1, index)));
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block overflow-visible">
          <defs>
            {series.map((entry, index) => (
              <linearGradient key={entry.name} id={`${gradient}-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={entry.color} stopOpacity="0.2" />
                <stop offset="1" stopColor={entry.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {domain.ticks.map((tick, index) => (
            <g key={tick}>
              <line x1={left} x2={left + innerWidth} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeDasharray={tick === 0 ? undefined : "2 4"} />
              <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-[var(--faint)] text-[10.5px] tabular-nums">{axis[index]}</text>
            </g>
          ))}
          {labelIndexes(count, Math.max(2, Math.floor(innerWidth / 72))).map((index) => (
            <text key={index} x={x(index)} y={height - 8} textAnchor={count > 1 && index === 0 ? "start" : count > 1 && index === count - 1 ? "end" : "middle"} className="fill-[var(--faint)] text-[10.5px]">{labels[index]}</text>
          ))}
          {target && target.value >= domain.min && target.value <= domain.max && (
            <g>
              <line x1={left} x2={left + innerWidth} y1={y(target.value)} y2={y(target.value)} stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={1} />
              <text x={left + innerWidth} y={y(target.value) - 5} textAnchor="end" className="fill-[var(--muted)] text-[10.5px] font-medium">{target.label}</text>
            </g>
          )}
          {series.map((entry, seriesIndex) =>
            segments(entry.values, entry.connectGaps).map((segment, segmentIndex) => {
              const line = segment.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"}${x(point.index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
              const first = segment[0]!;
              const last = segment[segment.length - 1]!;
              return (
                <g key={`${entry.name}-${segmentIndex}`}>
                  {entry.area && segment.length > 1 && (
                    <path className="fade-in-late" d={`${line} L${x(last.index).toFixed(1)},${baseline.toFixed(1)} L${x(first.index).toFixed(1)},${baseline.toFixed(1)} Z`} fill={`url(#${gradient}-${seriesIndex})`} />
                  )}
                  {segment.length > 1 ? (
                    <path className="draw" pathLength={1} d={line} fill="none" stroke={entry.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  ) : (
                    <circle cx={x(first.index)} cy={y(first.value)} r={2.5} fill={entry.color} />
                  )}
                </g>
              );
            }),
          )}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={TOP + innerHeight} stroke="var(--border-strong)" />
              {series.map((entry) => {
                const value = entry.values[hover];
                return value === null || value === undefined ? null : <circle key={entry.name} cx={x(hover)} cy={y(value)} r={4} fill="var(--surface)" stroke={entry.color} strokeWidth={2} />;
              })}
            </g>
          )}
          <rect x={left} y={TOP} width={innerWidth} height={innerHeight} fill="transparent" />
        </svg>
      )}
      {hover !== null && width > 0 && (
        <ChartTooltip
          x={x(hover)}
          containerWidth={width}
          title={titles?.[hover] ?? labels[hover]}
          rows={[
            ...series.map((entry) => {
              const value = entry.values[hover];
              return { label: entry.name, color: entry.color, value: value === null || value === undefined ? "—" : format(value) };
            }),
            ...(target ? [{ label: target.label, value: format(target.value) }] : []),
          ]}
        />
      )}
    </div>
  );
}
