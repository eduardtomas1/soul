import { Archive, PencilSimple, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import type { IsoDate } from "@shared/contracts/common";
import type { Measure, MeasureEntry } from "@shared/contracts/measures";
import { addDays, eachDay } from "@shared/dates";
import { formatMeasure, formatMeasureValue, targetGap } from "@shared/measures";
import { formatRelativeDay, formatShortDate, formatWeekdayDate } from "@/lib/format";
import { IconButton, Metrics, Panel, Segmented } from "@/components/primitives";
import { IconBadge } from "@/components/glyph";
import { LineChart } from "@/components/charts";
import { MeasureValueInput } from "./measure-input";
import { statsFor } from "./measure-stats";

type Range = "30" | "90" | "365";
const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

export function MeasureDetail({ measure, entries, today, onEdit, onArchive, onDelete }: { measure: Measure; entries: readonly MeasureEntry[]; today: IsoDate; onEdit: () => void; onArchive: () => void; onDelete: () => void }) {
  const [range, setRange] = useState<Range>("90");
  const [logDate, setLogDate] = useState<IsoDate>(today);
  const stats = statsFor(entries, today);
  const toTarget = stats.latest ? targetGap(measure, stats.latest.value) : null;
  const format = (value: number) => formatMeasure(value, measure.decimals, measure.unit);
  const days = eachDay(addDays(today, -(Number(range) - 1)), today);
  const byDate = new Map(entries.map((entry) => [entry.date, entry.value]));
  const recent = [...entries].reverse().slice(0, 8);

  return (
    <Panel
      className="min-[1180px]:sticky min-[1180px]:top-6"
      title={<span className="flex items-center gap-2"><IconBadge name={measure.icon} tone={measure.color} size={24} />{measure.name}</span>}
      actions={
        <>
          <IconButton label="Edit" size="sm" onClick={onEdit}><PencilSimple size={15} /></IconButton>
          <IconButton label="Archive" size="sm" onClick={onArchive}><Archive size={15} /></IconButton>
          <IconButton label="Delete" size="sm" onClick={onDelete}><Trash size={15} /></IconButton>
        </>
      }
      bodyClassName="flex flex-col gap-5 p-5"
    >
      <Metrics
        items={[
          { label: "Latest", value: stats.latest ? format(stats.latest.value) : "—", hint: stats.latest ? formatRelativeDay(stats.latest.date, today) : "no value yet" },
          { label: "7-day average", value: stats.average7 === null ? "—" : format(stats.average7) },
          { label: "30-day average", value: stats.average30 === null ? "—" : format(stats.average30) },
          measure.target !== null
            ? { label: "To target", value: toTarget === null ? "—" : toTarget.reached ? "Reached" : format(toTarget.gap), hint: `target ${format(measure.target)}${measure.direction === "up" ? " or more" : measure.direction === "down" ? " or less" : ""}` }
            : { label: "Range", value: stats.min === null || stats.max === null ? "—" : `${formatMeasureValue(stats.min, measure.decimals)}–${formatMeasureValue(stats.max, measure.decimals)}`, hint: "lowest to highest" },
        ]}
      />
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="label-caps">History</span>
          <Segmented size="sm" value={range} onChange={setRange} options={RANGES} />
        </div>
        {entries.length === 0 ? (
          <div className="rounded-[7px] border border-dashed border-border-strong px-4 py-8 text-center text-[12.5px] text-muted">Log a first value below to start the chart.</div>
        ) : (
          <LineChart
            axisStep={10 ** -measure.decimals}
            key={range}
            labels={days.map((day) => formatShortDate(day))}
            titles={days.map((day) => formatWeekdayDate(day))}
            height={210}
            ariaLabel={`${measure.name} over the last ${range} days`}
            format={format}
            formatAxis={(value) => formatMeasureValue(value, measure.decimals)}
            target={measure.target === null ? null : { value: measure.target, label: `Target ${format(measure.target)}` }}
            series={[{ name: measure.name, color: `var(--tone-${measure.color})`, values: days.map((day) => byDate.get(day) ?? null), area: true, connectGaps: true }]}
          />
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-[8px] border border-border bg-surface-2 p-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted">Day</span>
          <input type="date" value={logDate} max={today} onChange={(event) => event.target.value && setLogDate(event.target.value)} className="h-8 rounded-[7px] border border-border-strong bg-surface px-2.5 text-[13px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted">Value</span>
          <MeasureValueInput key={logDate} measure={measure} date={logDate} value={byDate.get(logDate) ?? null} className="w-[150px]" />
        </label>
        <span className="pb-2 text-[12px] text-muted">Enter saves, an empty value clears the day.</span>
      </div>
      {recent.length > 0 && (
        <table className="data-table -mx-4 w-[calc(100%+2rem)] border-t border-border">
          <thead>
            <tr><th>Day</th><th className="num">Value</th><th className="num">Change</th></tr>
          </thead>
          <tbody>
            {recent.map((entry, index) => {
              const before = recent[index + 1];
              const change = before ? entry.value - before.value : null;
              return (
                <tr key={entry.date}>
                  <td>{formatWeekdayDate(entry.date)}</td>
                  <td className="num font-medium">{format(entry.value)}</td>
                  <td className="num text-muted">{change === null || change === 0 ? "—" : `${change > 0 ? "+" : "−"}${formatMeasureValue(Math.abs(change), measure.decimals)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
