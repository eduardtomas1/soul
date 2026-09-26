import type { IsoDate } from "./contracts/common";
import { addDays, isScheduledOn, startOfWeek } from "./dates";

export interface StreakInput {
  readonly cadence: "daily" | "weekly";
  readonly weekdayMask: number;
  readonly targetCount: number;
  readonly counts: ReadonlyMap<IsoDate, number>;
  readonly createdOn: IsoDate;
  readonly today: IsoDate;
}

export interface StreakResult {
  readonly current: number;
  readonly best: number;
  readonly completedLast30: number;
  readonly scheduledLast30: number;
  readonly totalCompleted: number;
}

export function isHabitDoneOn(input: StreakInput, date: IsoDate): boolean {
  if (input.cadence === "daily") return (input.counts.get(date) ?? 0) >= input.targetCount;
  return weeklyTotal(input, date) >= input.targetCount;
}

export function weeklyTotal(input: StreakInput, date: IsoDate): number {
  const monday = startOfWeek(date);
  let total = 0;
  for (let offset = 0; offset < 7; offset += 1) total += input.counts.get(addDays(monday, offset)) ?? 0;
  return total;
}

export function computeStreaks(input: StreakInput): StreakResult {
  return input.cadence === "daily" ? dailyStreaks(input) : weeklyStreaks(input);
}

function dailyStreaks(input: StreakInput): StreakResult {
  let current = 0;
  let best = 0;
  let run = 0;
  let completedLast30 = 0;
  let scheduledLast30 = 0;
  let totalCompleted = 0;
  const thirtyDaysAgo = addDays(input.today, -29);
  for (let date = input.createdOn; date <= input.today; date = addDays(date, 1)) {
    if (!isScheduledOn(input.weekdayMask, date)) continue;
    const done = (input.counts.get(date) ?? 0) >= input.targetCount;
    if (date >= thirtyDaysAgo) {
      scheduledLast30 += 1;
      if (done) completedLast30 += 1;
    }
    if (done) {
      totalCompleted += 1;
      run += 1;
      if (run > best) best = run;
    } else if (date !== input.today) {
      run = 0;
    }
  }
  current = run;
  return { current, best, completedLast30, scheduledLast30, totalCompleted };
}

function weeklyStreaks(input: StreakInput): StreakResult {
  let best = 0;
  let run = 0;
  let totalCompleted = 0;
  let completedLast30 = 0;
  let scheduledLast30 = 0;
  const thisWeek = startOfWeek(input.today);
  const thirtyDaysAgo = addDays(input.today, -29);
  for (let monday = startOfWeek(input.createdOn); monday <= thisWeek; monday = addDays(monday, 7)) {
    const done = weeklyTotal(input, monday) >= input.targetCount;
    if (monday >= startOfWeek(thirtyDaysAgo)) {
      scheduledLast30 += 1;
      if (done) completedLast30 += 1;
    }
    if (done) {
      totalCompleted += 1;
      run += 1;
      if (run > best) best = run;
    } else if (monday !== thisWeek) {
      run = 0;
    }
  }
  return { current: run, best, completedLast30, scheduledLast30, totalCompleted };
}
