import type { Habit, HabitStats, Medal } from "@shared/contracts/habits";
import type { DaySummary } from "@shared/contracts/journal";
import { toIsoDate } from "@shared/dates";
import { pluralize } from "@/lib/format";
import { KpiGrid, formatCount } from "@/components/kpi";
import { formatPeriods, streakInDays } from "./habit-schedule";

export function HabitSummary({ habits, stats, medals, days }: { habits: readonly Habit[]; stats: ReadonlyMap<string, HabitStats>; medals: readonly Medal[]; days: readonly DaySummary[] }) {
  const today = days[days.length - 1];
  const withDue = days.filter((day) => day.habitsDue > 0);
  const daily = habits.filter((habit) => habit.cadence === "daily");
  const scheduled = daily.reduce((sum, habit) => sum + (stats.get(habit.id)?.scheduledLast30 ?? 0), 0);
  const completed = daily.reduce((sum, habit) => sum + (stats.get(habit.id)?.completedLast30 ?? 0), 0);
  const leader = habits.reduce<{ habit: Habit | null; streak: number; days: number }>((best, habit) => {
    const streak = stats.get(habit.id)?.currentStreak ?? 0;
    const days = streakInDays(habit, streak);
    return days > best.days ? { habit, streak, days } : best;
  }, { habit: null, streak: 0, days: 0 });
  const since = days[0]?.date ?? "";
  const recentMedals = medals.filter((medal) => toIsoDate(new Date(medal.earnedAt)) >= since).length;
  return (
    <KpiGrid
      items={[
        { label: "Done today", value: today?.habitsDone ?? 0, format: formatCount, suffix: `/ ${today?.habitsDue ?? 0}`, hint: "daily habits", trend: withDue.slice(-14).map((day) => day.habitsDone / day.habitsDue) },
        { label: "Last 30 days", value: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0, format: (value) => (scheduled > 0 ? `${Math.round(value)}%` : "—"), hint: scheduled > 0 ? `${completed} of ${scheduled} scheduled days, daily habits` : "No daily habits yet", trend: withDue.map((day) => day.habitsDone / day.habitsDue) },
        { label: "Longest streak now", value: leader.streak, format: formatCount, suffix: leader.habit ? formatPeriods(leader.habit, leader.streak).replace(/^\d+ /u, "") : "days", hint: leader.habit ? leader.habit.name : "Start a streak today" },
        { label: "Milestones", value: medals.length, format: formatCount, hint: recentMedals > 0 ? `${pluralize(recentMedals, "new one")} this month` : "reached so far" },
      ]}
    />
  );
}
