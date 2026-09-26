import { clsx } from "clsx";
import { useId } from "react";
import { useWidth } from "./use-width";

export function Sparkline({ points, color = "var(--signal)", height = 36, className, area = true }: { points: readonly number[]; color?: string; height?: number; className?: string; area?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gradient = useId();
  const drawable = width > 0 && points.length >= 2;
  let line = "";
  let last: readonly [number, number] = [0, 0];
  if (drawable) {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const step = (width - 4) / (points.length - 1);
    const coordinates = points.map((value, index) => [2 + index * step, height - 3 - ((value - min) / range) * (height - 8)] as const);
    line = coordinates.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    last = coordinates[coordinates.length - 1]!;
  }
  return (
    <div ref={ref} className={clsx("w-full", className)} style={{ height }} aria-hidden="true">
      {drawable && (
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.22" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {area && <path className="fade-in-late" d={`${line} L${width - 2},${height} L2,${height} Z`} fill={`url(#${gradient})`} />}
          <path className="draw" pathLength={1} d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
          <circle className="fade-in-late" cx={last[0]} cy={last[1]} r={2.75} fill={color} />
        </svg>
      )}
    </div>
  );
}
