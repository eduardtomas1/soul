import type { IsoDate } from "@shared/contracts/common";
import type { Habit } from "@shared/contracts/habits";
import { addDays, isScheduledOn, startOfWeek, weekdaysToMask } from "@shared/dates";

export interface WeekRate {
  readonly start: IsoDate;
  readonly rate: number;
  readonly done: number;
  readonly expected: number;
}

export function weeklyRates(habit: Habit, counts: ReadonlyMap<IsoDate, number>, today: IsoDate, weeks: number, since: IsoDate): WeekRate[] {
  const mask = weekdaysToMask(habit.weekdays);
  const thisWeek = startOfWeek(today);
  const firstWeek = startOfWeek(since);
  return Array.from({ length: weeks }, (_, index) => addDays(thisWeek, (index - weeks + 1) * 7)).filter((start) => start >= firstWeek).map((start) => {
    const days = Array.from({ length: 7 }, (__, offset) => addDays(start, offset)).filter((date) => date <= today && date >= since);
    if (habit.cadence === "weekly") {
      const total = days.reduce((sum, date) => sum + (counts.get(date) ?? 0), 0);
      return { start, rate: Math.min(1, total / habit.targetCount), done: total, expected: habit.targetCount };
    }
    const scheduled = days.filter((date) => isScheduledOn(mask, date));
    const done = scheduled.filter((date) => (counts.get(date) ?? 0) >= habit.targetCount).length;
    return { start, rate: scheduled.length > 0 ? done / scheduled.length : 0, done, expected: scheduled.length };
  });
}
