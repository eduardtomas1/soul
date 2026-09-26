import type { IsoDate } from "@shared/contracts/common";
import type { Today } from "@shared/contracts/today";
import { addDays, addMonths, firstDayOfMonth, monthOf, startOfWeek, weekdaysToMask, isScheduledOn } from "@shared/dates";
import { occurrencesBetween } from "@shared/recurrence";
import { buildDayLog, summarizeDays, type LogSources } from "./days";

const TREND_DAYS = 30;

export function buildToday(date: IsoDate, sources: LogSources): Today {
  const { routines, habits, medals, finances, measures } = sources;
  const activeRoutines = routines.list().filter((routine) => routine.archivedAt === null && isScheduledOn(weekdaysToMask(routine.weekdays), date));
  const routineIds = new Set(activeRoutines.map((routine) => routine.id));
  const routineDays = routines.dayStates(date).filter((day) => routineIds.has(day.routineId));
  const activeHabits = habits.list().filter((habit) => habit.archivedAt === null && (habit.cadence === "weekly" || isScheduledOn(weekdaysToMask(habit.weekdays), date)));
  const monday = startOfWeek(date);
  const habitEntries = habits.entries(monday, addDays(monday, 6)).filter((entry) => activeHabits.some((habit) => habit.id === entry.habitId));
  const habitStats = activeHabits.map((habit) => habits.stats(habit, date));
  const horizon = addDays(date, 14);
  const upcoming = finances.recurring.list().flatMap((rule) =>
    occurrencesBetween(rule, date, horizon)
      .filter((dueOn) => dueOn >= rule.nextDueOn)
      .map((dueOn) => ({ ruleId: rule.id, name: rule.name, dueOn, amountCents: rule.amountCents })),
  ).sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0)).slice(0, 8);
  const windowStart = addDays(date, -(TREND_DAYS - 1));
  const monthStart = firstDayOfMonth(monthOf(date));
  const days = summarizeDays(sources, monthStart < windowStart ? monthStart : windowStart, date);
  const sameDayLastMonth = addMonths(date, -1);
  return {
    date,
    routines: activeRoutines,
    routineDays,
    habits: activeHabits,
    habitEntries,
    habitStats,
    measures: measures.list().filter((measure) => measure.archivedAt === null),
    measureEntries: measures.entries(addDays(date, -(TREND_DAYS - 1)), date),
    log: buildDayLog(sources, date, days[days.length - 1]),
    days,
    upcoming,
    netWorthCents: finances.netWorthCents(),
    monthExpenseCents: finances.totalsBetween(firstDayOfMonth(monthOf(date)), date).expenseCents,
    lastMonthToDateExpenseCents: finances.totalsBetween(firstDayOfMonth(monthOf(sameDayLastMonth)), sameDayLastMonth).expenseCents,
    recentMedals: medals.recent(6),
  };
}
