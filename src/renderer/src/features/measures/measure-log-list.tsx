import type { IsoDate } from "@shared/contracts/common";
import type { Measure, MeasureEntry } from "@shared/contracts/measures";
import { formatMeasure } from "@shared/measures";
import { IconBadge } from "@/components/glyph";
import { MeasureValueInput } from "./measure-input";

export function previousValue(entries: readonly MeasureEntry[], measureId: string, before: IsoDate): MeasureEntry | null {
  let found: MeasureEntry | null = null;
  for (const entry of entries) {
    if (entry.measureId === measureId && entry.date < before && (found === null || entry.date > found.date)) found = entry;
  }
  return found;
}

export function MeasureLogList({ measures, entries, date, flush = false }: { measures: readonly Measure[]; entries: readonly MeasureEntry[]; date: IsoDate; flush?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {measures.map((measure) => {
        const current = entries.find((entry) => entry.measureId === measure.id && entry.date === date) ?? null;
        const previous = previousValue(entries, measure.id, date);
        return (
          <li key={measure.id} className={flush ? "flex items-center gap-3 py-3" : "flex items-center gap-3 px-5 py-3"}>
            <IconBadge name={measure.icon} tone={measure.color} size={26} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{measure.name}</div>
              <div className="truncate text-[12px] text-muted">{previous ? `Last ${formatMeasure(previous.value, measure.decimals, measure.unit)}` : measure.target !== null ? `Target ${formatMeasure(measure.target, measure.decimals, measure.unit)}` : "No value yet"}</div>
            </div>
            <MeasureValueInput key={`${measure.id}-${date}`} measure={measure} date={date} value={current?.value ?? null} className="w-[132px]" />
          </li>
        );
      })}
    </ul>
  );
}
