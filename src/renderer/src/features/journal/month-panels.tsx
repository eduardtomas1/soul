import type { DaySummary } from "@shared/contracts/journal";
import { formatCents } from "@shared/money";
import { average, formatDecimal, formatShortDate, formatWeekdayDate } from "@/lib/format";
import { Metrics, Panel } from "@/components/primitives";
import { LineChart } from "@/components/charts";

export function MonthNumbers({ days }: { days: readonly DaySummary[] }) {
  const written = days.filter((day) => day.hasNote || day.mood !== null || day.energy !== null).length;
  const mood = average(days.flatMap((day) => (day.mood === null ? [] : [day.mood])));
  const due = days.reduce((sum, day) => sum + day.habitsDue + day.routinesDue, 0);
  const done = days.reduce((sum, day) => sum + day.habitsDone + day.routinesDone, 0);
  const spent = days.reduce((sum, day) => sum + day.expenseCents, 0);
  return (
    <Metrics
      items={[
        { label: "Days written", value: `${written} / ${days.length}` },
        { label: "Average mood", value: mood === null ? "—" : `${formatDecimal(mood)} / 5` },
        { label: "Done on time", value: due === 0 ? "—" : `${Math.round((done / due) * 100)}%`, hint: "habits and routines" },
        { label: "Spent", value: formatCents(spent) },
      ]}
    />
  );
}

export function MoodChart({ days }: { days: readonly DaySummary[] }) {
  const rated = days.some((day) => day.mood !== null || day.energy !== null);
  return (
    <Panel title="Mood and energy" meta="this month">
      {rated ? (
        <div className="px-4 pt-4 pb-3">
          <LineChart
            axisStep={1}
            labels={days.map((day) => formatShortDate(day.date))}
            titles={days.map((day) => formatWeekdayDate(day.date))}
            height={170}
            ariaLabel="Mood and energy this month"
            domain={{ min: 1, max: 5 }}
            format={(value) => `${value} / 5`}
            formatAxis={(value) => String(value)}
            series={[
              { name: "Mood", color: "var(--signal)", values: days.map((day) => day.mood), area: true, connectGaps: true },
              { name: "Energy", color: "var(--series-2)", values: days.map((day) => day.energy), connectGaps: true },
            ]}
          />
        </div>
      ) : (
        <div className="px-5 py-5 text-[12.5px] text-muted">Rate your mood and energy to see how the month went.</div>
      )}
    </Panel>
  );
}
