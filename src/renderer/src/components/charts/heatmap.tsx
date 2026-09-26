import { clsx } from "clsx";
import type { ColorToken, IsoDate } from "@shared/contracts/common";
import { addDays, daysBetween, weekdayOf } from "@shared/dates";

export function Heatmap({ from, to, values, tone, cell = 11, gap = 3, className, onHover }: { from: IsoDate; to: IsoDate; values: ReadonlyMap<IsoDate, number>; tone: ColorToken; cell?: number; gap?: number; className?: string; onHover?: (date: IsoDate | null) => void }) {
  const start = addDays(from, -weekdayOf(from));
  const total = daysBetween(start, to) + 1;
  const weeks = Math.ceil(total / 7);
  const width = weeks * (cell + gap) - gap;
  const height = 7 * (cell + gap) - gap;
  const cells: Array<{ date: IsoDate; x: number; y: number; level: number; inRange: boolean; week: number }> = [];
  for (let index = 0; index < weeks * 7; index += 1) {
    const date = addDays(start, index);
    if (date > to) break;
    const week = Math.floor(index / 7);
    cells.push({ date, x: week * (cell + gap), y: (index % 7) * (cell + gap), level: values.get(date) ?? 0, inRange: date >= from, week });
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={clsx("block h-auto w-full", `tone-${tone}`, className)} style={{ maxWidth: width }} role="img" aria-label="Completion history">
      {cells.map((entry) => (
        <rect
          key={entry.date}
          className="fade"
          style={{ animationDelay: `${Math.min(entry.week * 8, 420)}ms` }}
          x={entry.x}
          y={entry.y}
          width={cell}
          height={cell}
          rx={2}
          fill={entry.level > 0 ? "var(--tone)" : "var(--surface-3)"}
          opacity={entry.inRange ? (entry.level > 0 ? 0.3 + 0.7 * Math.min(1, entry.level) : 1) : 0.25}
          onMouseEnter={onHover ? () => onHover(entry.date) : undefined}
          onMouseLeave={onHover ? () => onHover(null) : undefined}
        >
          <title>{entry.date}</title>
        </rect>
      ))}
    </svg>
  );
}
