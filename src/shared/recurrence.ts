import type { IsoDate } from "./contracts/common";
import type { RecurringFrequency } from "./contracts/finances";
import { addDays, addMonths, parseIsoDate, toIsoDate } from "./dates";

export interface RecurrenceRule {
  readonly frequency: RecurringFrequency;
  readonly interval: number;
  readonly anchorDate: IsoDate;
  readonly endDate: IsoDate | null;
}

export function nthOccurrence(rule: RecurrenceRule, index: number): IsoDate {
  switch (rule.frequency) {
    case "weekly":
      return addDays(rule.anchorDate, 7 * rule.interval * index);
    case "monthly":
      return addMonths(rule.anchorDate, rule.interval * index);
    case "yearly": {
      const anchor = parseIsoDate(rule.anchorDate);
      const target = new Date(anchor.getFullYear() + rule.interval * index, anchor.getMonth(), 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(anchor.getDate(), lastDay));
      return toIsoDate(target);
    }
  }
}

export function occurrencesBetween(rule: RecurrenceRule, from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let index = 0; index < 10_000; index += 1) {
    const date = nthOccurrence(rule, index);
    if (date > to) break;
    if (rule.endDate !== null && date > rule.endDate) break;
    if (date >= from) dates.push(date);
  }
  return dates;
}

export function nextOccurrenceOnOrAfter(rule: RecurrenceRule, date: IsoDate): IsoDate | null {
  for (let index = 0; index < 10_000; index += 1) {
    const candidate = nthOccurrence(rule, index);
    if (rule.endDate !== null && candidate > rule.endDate) return null;
    if (candidate >= date) return candidate;
  }
  return null;
}
