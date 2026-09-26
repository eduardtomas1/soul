import type { DaySummary } from "@shared/contracts/journal";
import type { Today } from "@shared/contracts/today";
import { formatCents, formatCentsCompact } from "@shared/money";
import { average, formatDecimal, formatSignedDecimal, pluralize } from "@/lib/format";
import { KpiGrid, deltaOf, formatCount } from "@/components/kpi";

function ratios(days: readonly DaySummary[], done: (day: DaySummary) => number, due: (day: DaySummary) => number): number[] {
  return days.filter((day) => due(day) > 0).map((day) => done(day) / due(day));
}

function left(done: number, due: number, noun: string): string {
  if (due === 0) return `No ${noun}s due`;
  if (done >= due) return `All ${noun}s done`;
  return `${pluralize(due - done, noun)} to go`;
}

export function Summary({ today }: { today: Today }) {
  const day = today.days[today.days.length - 1]!;
  const recent = today.days.slice(-14);
  const moodsThisWeek = today.days.slice(-7).flatMap((entry) => (entry.mood === null ? [] : [entry.mood]));
  const moodsWeekBefore = today.days.slice(-14, -7).flatMap((entry) => (entry.mood === null ? [] : [entry.mood]));
  const mood = average(moodsThisWeek);
  const moodBefore = average(moodsWeekBefore);
  const month = today.date.slice(0, 7);
  const monthToDate = today.days
    .filter((entry) => entry.date.startsWith(month))
    .reduce<number[]>((sums, entry) => [...sums, (sums[sums.length - 1] ?? 0) + entry.expenseCents], []);
  const spendChange = today.monthExpenseCents - today.lastMonthToDateExpenseCents;

  return (
    <KpiGrid
      items={[
        {
          label: "Routines",
          value: day.routinesDone,
          format: formatCount,
          suffix: `/ ${day.routinesDue}`,
          hint: left(day.routinesDone, day.routinesDue, "routine"),
          trend: ratios(recent, (entry) => entry.routinesDone, (entry) => entry.routinesDue),
        },
        {
          label: "Daily habits",
          value: day.habitsDone,
          format: formatCount,
          suffix: `/ ${day.habitsDue}`,
          hint: left(day.habitsDone, day.habitsDue, "habit"),
          trend: ratios(recent, (entry) => entry.habitsDone, (entry) => entry.habitsDue),
        },
        {
          label: "Mood, last 7 days",
          value: mood ?? 0,
          format: (value) => (mood === null ? "—" : formatDecimal(value)),
          ...(mood === null ? {} : { suffix: "/ 5" }),
          hint: mood === null ? "Rate your mood in the journal" : `${moodsThisWeek.length} of 7 days rated`,
          delta: mood !== null && moodBefore !== null ? deltaOf(mood - moodBefore, formatSignedDecimal(mood - moodBefore), true) : null,
          trend: recent.flatMap((entry) => (entry.mood === null ? [] : [entry.mood])),
        },
        {
          label: "Spent this month",
          value: today.monthExpenseCents,
          format: (value) => formatCents(Math.round(value)),
          hint: `${formatCents(today.lastMonthToDateExpenseCents)} by this day last month`,
          delta: today.lastMonthToDateExpenseCents > 0 ? deltaOf(spendChange, formatCentsCompact(Math.abs(spendChange)), false) : null,
          trend: monthToDate.some((value) => value > 0) ? monthToDate : [],
          trendColor: "var(--text)",
        },
      ]}
    />
  );
}
