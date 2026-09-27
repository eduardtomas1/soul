import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { clsx } from "clsx";
import type { IsoDate, IsoMonth } from "@shared/contracts/common";
import type { DaySummary } from "@shared/contracts/journal";
import { addDays, addMonthsToMonth, firstDayOfMonth, lastDayOfMonth, monthOf, weekdayOf } from "@shared/dates";
import { WEEKDAY_SHORT, formatMonth, formatWeekdayDate } from "@/lib/format";
import { IconButton, Panel } from "@/components/primitives";

function moodBackground(mood: number | null): string | undefined {
  return mood === null ? undefined : `color-mix(in oklab, var(--signal) ${8 + mood * 9}%, var(--surface))`;
}

function consistency(day: DaySummary | undefined): number | null {
  if (!day) return null;
  const due = day.habitsDue + day.routinesDue;
  return due === 0 ? null : (day.habitsDone + day.routinesDone) / due;
}

export function MonthCalendar({ month, days, selected, today, onSelect, onMonth }: { month: IsoMonth; days: readonly DaySummary[]; selected: IsoDate; today: IsoDate; onSelect: (date: IsoDate) => void; onMonth: (month: IsoMonth) => void }) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = firstDayOfMonth(month);
  const last = lastDayOfMonth(month);
  const start = addDays(first, -weekdayOf(first));
  const cells: IsoDate[] = [];
  for (let date = start; date <= last || weekdayOf(date) !== 0; date = addDays(date, 1)) cells.push(date);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));

  return (
    <Panel
      title={formatMonth(month)}
      actions={
        <>
          <IconButton label="Previous month" size="sm" onClick={() => onMonth(addMonthsToMonth(month, -1))}><CaretLeft size={14} weight="bold" /></IconButton>
          <IconButton label="Next month" size="sm" disabled={month >= monthOf(today)} onClick={() => onMonth(addMonthsToMonth(month, 1))}><CaretRight size={14} weight="bold" /></IconButton>
        </>
      }
      bodyClassName="p-4"
    >
      <div className="flex flex-col gap-2" role="grid" aria-label={`Journal for ${formatMonth(month)}`}>
        <div role="row" className="grid grid-cols-7 gap-2">
          {WEEKDAY_SHORT.map((label) => <div key={label} role="columnheader" className="pb-1 text-center text-[10.5px] font-semibold tracking-[0.05em] text-faint uppercase">{label}</div>)}
        </div>
        {weeks.map((week, weekIndex) => (
          <div key={week[0]} role="row" className="grid grid-cols-7 gap-2">
            {week.map((date, dayIndex) => {
              const index = weekIndex * 7 + dayIndex;
              const inMonth = date.startsWith(month);
              const future = date > today;
              const day = byDate.get(date);
              const ratio = consistency(day);
              const isSelected = date === selected;
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={formatWeekdayDate(date)}
                  disabled={future || !inMonth}
                  onClick={() => onSelect(date)}
                  className={clsx(
                    "fade relative flex h-[54px] min-w-0 flex-col rounded-[8px] border p-2 text-left transition-[border-color,box-shadow,transform] duration-150",
                    !inMonth ? "invisible" : future ? "border-border/60 text-faint" : "border-border hover:-translate-y-px hover:border-faint",
                    isSelected && "border-signal shadow-[0_0_0_1px_var(--signal)]",
                  )}
                  style={{ animationDelay: `${Math.min(index * 10, 360)}ms`, background: inMonth && !future ? moodBackground(day?.mood ?? null) : undefined }}
                >
                  <span className={clsx("text-[12px] leading-none font-semibold tabular-nums", date === today && "text-link")}>{Number(date.slice(8))}</span>
                  {day?.hasNote && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-text" aria-label="Has a note" />}
                  {ratio !== null && (
                    <span className="mt-auto h-[3px] w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text)_12%,transparent)]">
                      <span className="block h-full rounded-full bg-text" style={{ width: `${Math.round(ratio * 100)}%` }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-2.5 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5">
          Mood
          {[1, 3, 5].map((mood) => <span key={mood} className="h-2.5 w-3.5 rounded-[2px] border border-border" style={{ background: moodBackground(mood) }} />)}
        </span>
        <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full bg-text" />Habits and routines done</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-text" />Note written</span>
      </div>
    </Panel>
  );
}
