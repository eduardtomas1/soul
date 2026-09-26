import type { IsoDate } from "@shared/contracts/common";
import type { Habit, Medal } from "@shared/contracts/habits";
import type { Routine } from "@shared/contracts/routines";
import { addDays, eachDay, isScheduledOn, lastDayOfMonth, monthOf, startOfWeek, weekdaysToMask, firstDayOfMonth } from "@shared/dates";
import { isHabitDoneOn } from "@shared/streaks";
import { trackingStart, type HabitsRepository, type MedalsRepository } from "../repositories/habits";
import type { RoutinesRepository } from "../repositories/routines";
import type { FinancesRepository } from "../repositories/finances";

export interface MedalService {
  readonly afterHabitEntry: (habit: Habit, date: IsoDate, today: IsoDate) => Medal[];
  readonly afterRoutineStep: (routine: Routine, date: IsoDate) => Medal[];
  readonly afterGoalChange: (goalId: string, achieved: boolean) => Medal[];
  readonly afterMonthClosed: (today: IsoDate) => Medal[];
  readonly afterPeriodsClosed: (today: IsoDate) => Medal[];
}

const STREAK_MEDALS = {
  daily: [
    [7, "streak-7"],
    [30, "streak-30"],
    [100, "streak-100"],
    [365, "streak-365"],
  ],
  weekly: [
    [1, "streak-7"],
    [4, "streak-30"],
    [14, "streak-100"],
    [52, "streak-365"],
  ],
} as const;

export function createMedalService(
  habits: HabitsRepository,
  routines: RoutinesRepository,
  finances: FinancesRepository,
  medals: MedalsRepository,
): MedalService {
  function push(target: Medal[], medal: Medal | null): void {
    if (medal) target.push(medal);
  }

  function habitInput(habit: Habit, today: IsoDate) {
    const counts = habits.countsFor(habit.id);
    return {
      cadence: habit.cadence,
      weekdayMask: weekdaysToMask(habit.weekdays),
      targetCount: habit.targetCount,
      counts,
      createdOn: trackingStart(habit.createdAt, counts, today),
      today,
    };
  }

  function everyHabitDone(from: IsoDate, to: IsoDate, today: IsoDate): boolean {
    const active = habits.list().filter((habit) => habit.archivedAt === null && trackingStart(habit.createdAt, habits.countsFor(habit.id), today) <= from);
    if (active.length === 0) return false;
    for (const habit of active) {
      const input = habitInput(habit, today);
      if (habit.cadence === "weekly") {
        for (let monday = startOfWeek(from); monday <= to; monday = addDays(monday, 7)) {
          if (!isHabitDoneOn(input, monday)) return false;
        }
        continue;
      }
      for (const date of eachDay(from, to)) {
        if (!isScheduledOn(input.weekdayMask, date)) continue;
        if (!isHabitDoneOn(input, date)) return false;
      }
    }
    return true;
  }

  return {
    afterHabitEntry(habit, date, today) {
      const earned: Medal[] = [];
      const stats = habits.stats(habit, today);
      if (stats.totalCompleted >= 1) push(earned, medals.award("first-step", "habit", habit.id));
      for (const [length, kind] of STREAK_MEDALS[habit.cadence]) {
        if (stats.bestStreak >= length) push(earned, medals.award(kind, "habit", habit.id));
      }
      const monday = startOfWeek(date);
      const sunday = addDays(monday, 6);
      if (sunday <= today && everyHabitDone(monday, sunday, today)) push(earned, medals.award("perfect-week", "global", monday));
      const month = monthOf(date);
      const monthEnd = lastDayOfMonth(month);
      if (monthEnd <= today && everyHabitDone(firstDayOfMonth(month), monthEnd, today)) {
        push(earned, medals.award("perfect-month", "global", month));
      }
      return earned;
    },
    afterRoutineStep(routine, date) {
      const earned: Medal[] = [];
      if (routine.steps.length === 0) return earned;
      const mask = weekdaysToMask(routine.weekdays);
      const check = (days: number, kind: "routine-week" | "routine-month") => {
        const from = addDays(date, -(days - 1));
        const completed = routines.completedDates(routine.id, from, date);
        let scheduled = 0;
        for (const day of eachDay(from, date)) {
          if (!isScheduledOn(mask, day)) continue;
          scheduled += 1;
          if (!completed.has(day)) return;
        }
        if (scheduled > 0) push(earned, medals.award(kind, "routine", routine.id));
      };
      check(7, "routine-week");
      check(30, "routine-month");
      return earned;
    },
    afterPeriodsClosed(today) {
      const earned: Medal[] = [];
      const thisWeek = startOfWeek(today);
      for (const weeksBack of [1, 2]) {
        const monday = addDays(thisWeek, -7 * weeksBack);
        if (everyHabitDone(monday, addDays(monday, 6), today)) push(earned, medals.award("perfect-week", "global", monday));
      }
      const previous = monthOf(addDays(firstDayOfMonth(monthOf(today)), -1));
      if (everyHabitDone(firstDayOfMonth(previous), lastDayOfMonth(previous), today)) push(earned, medals.award("perfect-month", "global", previous));
      return earned;
    },
    afterGoalChange(goalId, achieved) {
      const earned: Medal[] = [];
      if (achieved) push(earned, medals.award("saver", "global", goalId));
      return earned;
    },
    afterMonthClosed(today) {
      const earned: Medal[] = [];
      const previous = monthOf(addDays(firstDayOfMonth(monthOf(today)), -1));
      const summary = finances.monthSummary(previous);
      const budgeted = summary.byCategory.filter((entry) => entry.limitCents !== null);
      if (budgeted.length === 0) return earned;
      if (budgeted.every((entry) => entry.spentCents <= (entry.limitCents ?? 0))) {
        push(earned, medals.award("budget-keeper", "global", previous));
      }
      return earned;
    },
  };
}
