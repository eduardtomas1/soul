import type { Habit } from "@shared/contracts/habits";
import { addDays, startOfWeek } from "@shared/dates";
import { describeWeekdays, pluralize } from "@/lib/format";

export function weekTotal(counts: ReadonlyMap<string, number>, date: string): number {
  const monday = startOfWeek(date);
  let total = 0;
  for (let offset = 0; offset < 7; offset += 1) total += counts.get(addDays(monday, offset)) ?? 0;
  return total;
}

export function isHabitDone(habit: Habit, count: number, weekCount: number): boolean {
  return (habit.cadence === "weekly" ? weekCount : count) >= habit.targetCount;
}

export function formatPeriods(habit: Habit, count: number): string {
  return pluralize(count, habit.cadence === "weekly" ? "week" : "day");
}

export function streakInDays(habit: Habit, streak: number): number {
  return habit.cadence === "weekly" ? streak * 7 : streak;
}

export function describeHabit(habit: Habit): string {
  const target = habit.kind === "count" ? `${habit.targetCount}${habit.unit ? ` ${habit.unit}` : ""}` : null;
  if (habit.cadence === "weekly") return target ? `${target} a week` : "Once a week";
  const days = describeWeekdays(habit.weekdays);
  return target ? `${target} · ${days}` : days;
}

export function groupEntries(entries: ReadonlyArray<{ habitId: string; date: string; count: number }>): Map<string, Map<string, number>> {
  const byHabit = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    const counts = byHabit.get(entry.habitId) ?? new Map<string, number>();
    counts.set(entry.date, entry.count);
    byHabit.set(entry.habitId, counts);
  }
  return byHabit;
}
