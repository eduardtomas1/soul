import { clsx } from "clsx";
import type { IsoDate } from "@shared/contracts/common";
import type { Measure, MeasureEntry } from "@shared/contracts/measures";
import { addDays, eachDay } from "@shared/dates";
import { formatWeekdayDate, formatWeekdayDay } from "@/lib/format";
import { Panel } from "@/components/primitives";
import { IconBadge } from "@/components/glyph";
import { MeasureValueInput } from "./measure-input";

const COLUMN_VISIBILITY = ["hidden @min-[870px]:table-cell", "hidden @min-[870px]:table-cell", "hidden @min-[690px]:table-cell", "hidden @min-[690px]:table-cell", "", "", ""] as const;

export function WeekGrid({ measures, entries, today }: { measures: readonly Measure[]; entries: readonly MeasureEntry[]; today: IsoDate }) {
  const days = eachDay(addDays(today, -6), today);
  const values = new Map(entries.map((entry) => [`${entry.measureId}|${entry.date}`, entry.value]));
  return (
    <Panel className="@container" title="Last 7 days" meta="Type a value and press Enter. Clear a cell to remove it.">
      <table className="data-table">
        <thead>
          <tr>
            <th>Measure</th>
            {days.map((day, index) => <th key={day} className={clsx("num", COLUMN_VISIBILITY[index], day === today && "text-signal")}>{day === today ? "Today" : formatWeekdayDay(day)}</th>)}
          </tr>
        </thead>
        <tbody>
          {measures.map((measure) => (
            <tr key={measure.id}>
              <td>
                <div className="flex min-w-[150px] items-center gap-2.5">
                  <IconBadge name={measure.icon} tone={measure.color} size={26} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{measure.name}</span>
                    {measure.unit && <span className="block text-[12px] text-muted">{measure.unit}</span>}
                  </span>
                </div>
              </td>
              {days.map((day, index) => (
                <td key={day} className={clsx("num px-2 last:pr-5", COLUMN_VISIBILITY[index])}>
                  <MeasureValueInput
                    key={`${measure.id}-${day}`}
                    measure={measure}
                    date={day}
                    value={values.get(`${measure.id}|${day}`) ?? null}
                    showUnit={false}
                    label={`${measure.name}, ${formatWeekdayDate(day)}`}
                    className="min-w-[76px]"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
