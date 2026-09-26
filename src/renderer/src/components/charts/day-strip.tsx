import { clsx } from "clsx";
import type { ColorToken, IsoDate } from "@shared/contracts/common";

export function DayStrip({ days, tone, compact = false, className }: { days: ReadonlyArray<{ date: IsoDate; level: number; scheduled: boolean }>; tone: ColorToken; compact?: boolean; className?: string }) {
  return (
    <div className={clsx("flex", compact ? "gap-[2px]" : "gap-[3px]", `tone-${tone}`, className)}>
      {days.map((day, index) => (
        <span
          key={day.date}
          title={day.date}
          className={clsx("fade rounded-[2px]", compact ? "h-2 w-2" : "h-2.5 w-2.5", !day.scheduled && "opacity-35")}
          style={{ animationDelay: `${index * 18}ms`, background: day.level >= 1 ? "var(--tone)" : day.level > 0 ? "color-mix(in oklab, var(--tone) 40%, var(--surface-3))" : "var(--surface-3)" }}
        />
      ))}
    </div>
  );
}
