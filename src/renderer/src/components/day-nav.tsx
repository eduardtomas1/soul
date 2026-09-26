import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useRef } from "react";
import type { IsoDate } from "@shared/contracts/common";
import { addDays } from "@shared/dates";
import { formatShortDate, formatRelativeDay } from "@/lib/format";

export function DayNav({ date, today, onChange, className }: { date: IsoDate; today: IsoDate; onChange: (date: IsoDate) => void; className?: string }) {
  const picker = useRef<HTMLInputElement>(null);
  const relative = formatRelativeDay(date, today);
  const label = relative === formatShortDate(date) ? relative : `${relative} · ${formatShortDate(date)}`;
  const button = "inline-flex h-9 w-9 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className={clsx("inline-flex items-center gap-2", className)}>
      <div className="inline-flex h-9 items-stretch overflow-hidden rounded-[7px] border border-border-strong bg-surface">
        <button type="button" aria-label="Previous day" title="Previous day" className={button} onClick={() => onChange(addDays(date, -1))}>
          <CaretLeft size={14} weight="bold" />
        </button>
        <div className="relative flex border-x border-border">
          <button
            type="button"
            className="inline-flex min-w-[148px] items-center justify-center gap-1.5 px-3 text-[12.5px] font-medium tabular-nums transition-colors hover:bg-surface-2"
            onClick={() => {
              try {
                picker.current?.showPicker();
              } catch {
                picker.current?.focus();
              }
            }}
            aria-label={`Choose a day, showing ${label}`}
          >
            <CalendarBlank size={14} className="text-muted" />
            {label}
          </button>
          <input
            ref={picker}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 opacity-0"
            value={date}
            max={today}
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value);
            }}
          />
        </div>
        <button type="button" aria-label="Next day" title="Next day" className={button} disabled={date >= today} onClick={() => onChange(addDays(date, 1))}>
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
      {date !== today && (
        <button type="button" onClick={() => onChange(today)} className="fade h-9 rounded-[7px] px-3 text-[12.5px] font-medium text-signal transition-colors hover:bg-signal-soft">
          Back to today
        </button>
      )}
    </div>
  );
}
