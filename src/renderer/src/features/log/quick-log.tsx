import { useEffect, useId, useMemo, useState } from "react";
import type { IsoDate } from "@shared/contracts/common";
import type { Today } from "@shared/contracts/today";
import { useToday } from "@/lib/clock";
import { useQuery } from "@/lib/query";
import { useToasts } from "@/lib/toasts";
import { Button, EmptyState, Kbd, Segmented, Skeleton } from "@/components/primitives";
import { DayNav } from "@/components/day-nav";
import { IconBadge } from "@/components/glyph";
import { Modal } from "@/components/sheet";
import { HabitControl } from "@/features/habits/habit-control";
import { describeHabit, groupEntries, weekTotal } from "@/features/habits/habit-schedule";
import { JournalEditor, SaveStatus, type SaveState } from "@/features/journal/journal-editor";
import { MeasureLogList } from "@/features/measures/measure-log-list";
import { RoutineChecklist } from "@/features/routines/routine-checklist";
import { MoneyForm } from "./money-form";
import type { LogMode, QuickLogOptions } from "./quick-log-context";

const MODES: ReadonlyArray<{ value: LogMode; label: string }> = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "habits", label: "Habits" },
  { value: "routines", label: "Routines" },
  { value: "measures", label: "Measures" },
  { value: "journal", label: "Journal" },
];

const LIVE_SCOPES = ["routines", "habits", "journal", "measures", "finances"] as const;

export function QuickLog({ initial, onClose }: { initial: QuickLogOptions; onClose: () => void }) {
  const today = useToday();
  const { push } = useToasts();
  const formId = useId();
  const [mode, setMode] = useState<LogMode>(initial.mode ?? "expense");
  const [date, setDate] = useState<IsoDate>(initial.date ?? today);
  const [journalState, setJournalState] = useState<{ date: IsoDate; state: SaveState } | null>(null);
  const day = useQuery("today.get", { date }, LIVE_SCOPES);
  const money = mode === "expense" || mode === "income";

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const index = Number(event.key) - 1;
      const next = MODES[index];
      if (next) {
        event.preventDefault();
        setMode(next.value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const logged = (message: string, keepOpen: boolean) => {
    push({ title: message, description: date === today ? undefined : `On ${date}`, tone: "success" });
    if (!keepOpen) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Log"
      width={660}
      align="top"
      headerExtra={<DayNav date={date} today={today} onChange={setDate} />}
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-[11.5px] text-faint">
            {money ? <><Kbd>Enter</Kbd> logs <span className="px-1">·</span> <Kbd>Ctrl Enter</Kbd> logs and adds another</> : mode === "journal" ? <SaveStatus state={journalState?.date === date ? journalState.state : "idle"} /> : "Changes are saved as you go"}
          </span>
          {money ? (
            <>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" type="submit" form={formId}>Log {mode}</Button>
            </>
          ) : (
            <Button variant="primary" onClick={onClose}>Done</Button>
          )}
        </>
      }
    >
      <Segmented value={mode} onChange={setMode} options={MODES} className="w-full [&>button]:flex-1" />
      <div key={money ? mode : `${mode}-${date}`} className="fade max-h-[52vh] min-h-[180px] overflow-y-auto">
        {money ? (
          <MoneyForm kind={mode} date={date} formId={formId} onLogged={logged} />
        ) : !day.data || day.data.date !== date ? (
          <div className="flex flex-col gap-2"><Skeleton height={36} /><Skeleton height={36} /><Skeleton height={36} /></div>
        ) : (
          <DayLists mode={mode} data={day.data} date={date} onJournalState={(state, day) => setJournalState({ date: day, state })} />
        )}
      </div>
    </Modal>
  );
}

function DayLists({ mode, data, date, onJournalState }: { mode: LogMode; data: Today; date: IsoDate; onJournalState: (state: SaveState, date: IsoDate) => void }) {
  const entries = useMemo(() => groupEntries(data.habitEntries), [data.habitEntries]);
  const days = useMemo(() => new Map(data.routineDays.map((routineDay) => [routineDay.routineId, routineDay])), [data.routineDays]);

  if (mode === "journal") return <JournalEditor key={date} date={date} entry={data.log.entry} rows={7} autoFocus onStateChange={onJournalState} />;

  if (mode === "measures") {
    if (data.measures.length === 0) return <EmptyState title="No measures yet" description="Create measures such as weight, sleep or steps in the Measures section." />;
    return <MeasureLogList measures={data.measures} entries={data.measureEntries} date={date} flush />;
  }

  if (mode === "habits") {
    if (data.habits.length === 0) return <EmptyState title="No habits due on this day" description="Habits appear here on the days they are scheduled." />;
    return (
      <ul className="divide-y divide-border">
        {data.habits.map((habit) => {
          const counts = entries.get(habit.id) ?? new Map<string, number>();
          return (
            <li key={habit.id} className="flex items-center gap-3 py-2">
              <IconBadge name={habit.icon} tone={habit.color} size={26} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{habit.name}</div>
                <div className="truncate text-[12px] text-muted">{describeHabit(habit)}</div>
              </div>
              <HabitControl habit={habit} date={date} count={counts.get(date) ?? 0} weekTotal={weekTotal(counts, date)} />
            </li>
          );
        })}
      </ul>
    );
  }

  if (data.routines.length === 0) return <EmptyState title="No routines on this day" description="Routines appear here on the days they are scheduled." />;
  return (
    <div className="flex flex-col gap-3">
      {data.routines.map((routine) => (
        <section key={routine.id}>
          <div className="mb-1 flex items-center gap-2 px-2">
            <IconBadge name={routine.icon} tone={routine.color} size={22} />
            <span className="text-[13px] font-semibold">{routine.name}</span>
            <span className="text-[12px] text-muted">{routine.timeOfDay ?? "Any time"}</span>
          </div>
          <RoutineChecklist routine={routine} day={days.get(routine.id)} date={date} compact />
        </section>
      ))}
    </div>
  );
}
