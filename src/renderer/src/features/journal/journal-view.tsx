import { Plus } from "@phosphor-icons/react";
import { useState } from "react";
import type { IsoDate, IsoMonth } from "@shared/contracts/common";
import { firstDayOfMonth, lastDayOfMonth, monthOf } from "@shared/dates";
import { usePickedDay, useToday } from "@/lib/clock";
import { useQuery } from "@/lib/query";
import { useNavigation } from "@/lib/navigation";
import { formatLongDate } from "@/lib/format";
import { Button, Columns, Panel, Skeleton, Stack } from "@/components/primitives";
import { Amount } from "@/components/pickers";
import { DayNav } from "@/components/day-nav";
import { Page } from "@/features/shell/page";
import { useQuickLog } from "@/features/log/quick-log-context";
import { ActivityList } from "./activity-list";
import { JournalEditor, SaveStatus, type SaveState } from "./journal-editor";
import { JournalSearch } from "./journal-search";
import { MonthCalendar } from "./month-calendar";
import { MonthNumbers, MoodChart } from "./month-panels";

const SCOPES = ["journal", "routines", "habits", "measures", "finances"] as const;

export function JournalView() {
  const today = useToday();
  const { route } = useNavigation();
  const openLog = useQuickLog();
  const [date, setDate] = usePickedDay(route.focusId);
  const [pickedMonth, setMonth] = useState<IsoMonth | null>(null);
  const month = pickedMonth ?? monthOf(date);
  const [saveState, setSaveState] = useState<{ date: IsoDate; state: SaveState } | null>(null);
  const day = useQuery("journal.day", { date }, SCOPES);
  const monthEnd = lastDayOfMonth(month) < today ? lastDayOfMonth(month) : today;
  const range = useQuery("journal.range", { from: firstDayOfMonth(month), to: monthEnd }, SCOPES);

  const select = (next: IsoDate) => {
    setDate(next);
    setMonth(monthOf(next) === monthOf(today) ? null : monthOf(next));
  };

  const log = day.data?.date === date ? day.data : null;
  const net = log ? log.summary.incomeCents - log.summary.expenseCents : 0;

  return (
    <Page
      title="Journal"
      subtitle="Notes, mood and everything you logged."
      actions={
        <>
          <DayNav date={date} today={today} onChange={select} />
          <Button variant="primary" icon={<Plus size={14} weight="bold" />} onClick={() => openLog({ date })}>Log</Button>
        </>
      }
      wide
    >
      <Columns main>
        <Stack>
          <Panel title={formatLongDate(date)} meta={<SaveStatus state={saveState?.date === date ? saveState.state : "idle"} />} bodyClassName="p-5">
            {log ? <JournalEditor key={log.date} date={log.date} entry={log.entry} rows={9} onStateChange={(state, day) => setSaveState({ date: day, state })} /> : <Skeleton height={260} />}
          </Panel>
          <Panel title="Logged this day" meta={log && log.activity.length > 0 ? String(log.activity.length) : undefined} actions={<Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={() => openLog({ date })}>Log</Button>}>
            {log ? <ActivityList key={log.date} items={log.activity} limit={10} empty="Nothing else was logged on this day." /> : <div className="p-4"><Skeleton height={120} /></div>}
            {log && log.summary.transactions > 0 && (
              <div className="flex items-center justify-between border-t border-border bg-surface-2 px-5 py-3 text-[12px] text-muted">
                <span>Money in and out, transfers excluded</span>
                <Amount cents={net} signed className="font-semibold" />
              </div>
            )}
          </Panel>
        </Stack>
        <Stack>
          <MonthCalendar month={month} days={range.data ?? []} selected={date} today={today} onSelect={select} onMonth={setMonth} />
          {range.data && <MonthNumbers days={range.data} />}
          {range.data && <MoodChart days={range.data} />}
          <JournalSearch onSelect={select} />
        </Stack>
      </Columns>
    </Page>
  );
}
