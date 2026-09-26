import { useState } from "react";
import type { DaySummary } from "@shared/contracts/journal";
import { formatCents, formatCentsCompact } from "@shared/money";
import { average, formatShortDate, formatWeekdayDate } from "@/lib/format";
import { Panel, Segmented } from "@/components/primitives";
import { ColumnChart, LineChart } from "@/components/charts";
import { ENERGY_LABELS, MOOD_LABELS } from "@/features/journal/rating";

type Metric = "consistency" | "spending" | "mood";

const METRICS: ReadonlyArray<{ value: Metric; label: string }> = [
  { value: "consistency", label: "Consistency" },
  { value: "spending", label: "Spending" },
  { value: "mood", label: "Mood" },
];

function consistency(day: DaySummary): number {
  const due = day.habitsDue + day.routinesDue;
  return due === 0 ? 0 : Math.round(((day.habitsDone + day.routinesDone) / due) * 100);
}

function Legend({ items }: { items: ReadonlyArray<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-4 text-[11.5px] text-muted">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: item.color }} />{item.label}</span>
      ))}
    </div>
  );
}

export function TrendsPanel({ days: history }: { days: readonly DaySummary[] }) {
  const [metric, setMetric] = useState<Metric>("consistency");
  const days = history.slice(-30);
  const labels = days.map((day) => formatShortDate(day.date));
  const titles = days.map((day) => formatWeekdayDate(day.date));
  const spent = days.map((day) => day.expenseCents);
  const averageSpent = Math.round(average(spent) ?? 0);

  return (
    <Panel title="Last 30 days" actions={<Segmented size="sm" value={metric} onChange={setMetric} options={METRICS} />}>
      <div key={metric} className="fade px-4 pt-4">
        {metric === "consistency" && (
          <ColumnChart
            axisStep={1}
            labels={labels}
            titles={titles}
            height={200}
            max={100}
            ariaLabel="Share of habits and routines done each day"
            format={(value) => `${value}%`}
            series={[{ name: "Done", color: "var(--signal)", values: days.map(consistency), colorFor: (value) => (value >= 100 ? "var(--signal)" : "color-mix(in oklab, var(--signal) 45%, var(--surface))") }]}
          />
        )}
        {metric === "spending" && (
          <ColumnChart
            axisStep={100}
            labels={labels}
            titles={titles}
            height={200}
            ariaLabel="Money spent each day"
            format={formatCents}
            formatAxis={formatCentsCompact}
            reference={averageSpent > 0 ? { value: averageSpent, label: `Average ${formatCentsCompact(averageSpent)}` } : null}
            series={[{ name: "Spent", color: "var(--text)", values: spent }]}
          />
        )}
        {metric === "mood" && (
          <LineChart
            axisStep={1}
            labels={labels}
            titles={titles}
            height={200}
            ariaLabel="Mood and energy each day"
            domain={{ min: 1, max: 5 }}
            format={(value) => `${value} / 5`}
            formatAxis={(value) => String(value)}
            series={[
              { name: "Mood", color: "var(--signal)", values: days.map((day) => day.mood), area: true, connectGaps: true },
              { name: "Energy", color: "var(--series-2)", values: days.map((day) => day.energy), connectGaps: true },
            ]}
          />
        )}
      </div>
      {metric === "consistency" && <Legend items={[{ label: "Everything done", color: "var(--signal)" }, { label: "Partly done", color: "color-mix(in oklab, var(--signal) 45%, var(--surface))" }]} />}
      {metric === "spending" && <Legend items={[{ label: "Spent per day, transfers excluded", color: "var(--text)" }]} />}
      {metric === "mood" && <Legend items={[{ label: `Mood (${MOOD_LABELS[0]} to ${MOOD_LABELS[4]})`, color: "var(--signal)" }, { label: `Energy (${ENERGY_LABELS[0]} to ${ENERGY_LABELS[4]})`, color: "var(--series-2)" }]} />}
    </Panel>
  );
}
