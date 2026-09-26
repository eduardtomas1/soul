import type { IsoDate } from "@shared/contracts/common";
import type { MeasureEntry } from "@shared/contracts/measures";
import { addDays } from "@shared/dates";
import { average } from "@/lib/format";

export interface MeasureStats {
  readonly latest: MeasureEntry | null;
  readonly change30: number | null;
  readonly average7: number | null;
  readonly average30: number | null;
  readonly min: number | null;
  readonly max: number | null;
}

export function groupByMeasure(entries: readonly MeasureEntry[]): Map<string, MeasureEntry[]> {
  const map = new Map<string, MeasureEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.measureId) ?? [];
    list.push(entry);
    map.set(entry.measureId, list);
  }
  for (const list of map.values()) list.sort((a, b) => (a.date < b.date ? -1 : 1));
  return map;
}

export function statsFor(entries: readonly MeasureEntry[], today: IsoDate): MeasureStats {
  const latest = entries[entries.length - 1] ?? null;
  const last30 = entries.filter((entry) => entry.date >= addDays(today, -29));
  const last7 = entries.filter((entry) => entry.date >= addDays(today, -6));
  const first30 = last30[0];
  const values = entries.map((entry) => entry.value);
  return {
    latest,
    change30: latest && first30 && first30.date !== latest.date ? latest.value - first30.value : null,
    average7: average(last7.map((entry) => entry.value)),
    average30: average(last30.map((entry) => entry.value)),
    min: values.length > 0 ? Math.min(...values) : null,
    max: values.length > 0 ? Math.max(...values) : null,
  };
}
