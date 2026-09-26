import { Check, ListChecks, Repeat } from "@phosphor-icons/react";
import { useMemo } from "react";
import type { Today } from "@shared/contracts/today";
import { pluralize } from "@/lib/format";
import { Button, EmptyState, Panel } from "@/components/primitives";
import { IconBadge } from "@/components/glyph";
import { ProgressRing } from "@/components/charts";
import { RoutineChecklist } from "@/features/routines/routine-checklist";
import { HabitControl } from "@/features/habits/habit-control";
import { describeHabit, formatPeriods, groupEntries, weekTotal } from "@/features/habits/habit-schedule";

export function RoutinesPanel({ today, onOpen }: { today: Today; onOpen: () => void }) {
  const dayByRoutine = useMemo(() => new Map(today.routineDays.map((day) => [day.routineId, day])), [today.routineDays]);
  const sorted = useMemo(() => [...today.routines].sort((a, b) => (a.timeOfDay ?? "99").localeCompare(b.timeOfDay ?? "99")), [today.routines]);
  return (
    <Panel title="Routines" meta={sorted.length > 0 ? pluralize(sorted.length, "routine") : undefined} actions={<Button variant="ghost" size="sm" onClick={onOpen}>View all</Button>}>
      {sorted.length === 0 ? (
        <EmptyState icon={<ListChecks size={20} />} title="Nothing scheduled" description="Routines scheduled for this day appear here with their steps." action={<Button onClick={onOpen}>Open routines</Button>} />
      ) : (
        <div className="divide-y divide-border">
          {sorted.map((routine) => {
            const day = dayByRoutine.get(routine.id);
            const done = day?.completedStepIds.length ?? 0;
            const total = routine.steps.length;
            return (
              <div key={routine.id} className="px-4 py-4">
                <div className="flex items-center gap-3 px-1 pb-3">
                  <IconBadge name={routine.icon} tone={routine.color} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{routine.name}</div>
                    <div className="text-[12px] text-muted">{routine.timeOfDay ?? "Any time"} · {done} of {total} steps</div>
                  </div>
                  <ProgressRing value={total > 0 ? done / total : 0} size={30} stroke={3.5} tone={routine.color}>
                    {done >= total && total > 0 ? <Check size={13} weight="bold" className="pop text-[var(--tone)]" /> : null}
                  </ProgressRing>
                </div>
                <RoutineChecklist routine={routine} day={day} date={today.date} compact />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function HabitsPanel({ today, onOpen }: { today: Today; onOpen: () => void }) {
  const entries = useMemo(() => groupEntries(today.habitEntries), [today.habitEntries]);
  const stats = useMemo(() => new Map(today.habitStats.map((entry) => [entry.habitId, entry])), [today.habitStats]);
  return (
    <Panel title="Habits" meta={today.habits.length > 0 ? `${pluralize(today.habits.length, "habit")} due` : undefined} actions={<Button variant="ghost" size="sm" onClick={onOpen}>View all</Button>}>
      {today.habits.length === 0 ? (
        <EmptyState icon={<Repeat size={20} />} title="No habits due" description="Add something you want to do regularly and track it here." action={<Button onClick={onOpen}>Open habits</Button>} />
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Habit</th><th className="num">Streak</th><th className="num">Progress</th></tr>
          </thead>
          <tbody>
            {today.habits.map((habit) => {
              const streak = stats.get(habit.id)?.currentStreak ?? 0;
              const counts = entries.get(habit.id) ?? new Map<string, number>();
              return (
                <tr key={habit.id}>
                  <td>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <IconBadge name={habit.icon} tone={habit.color} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{habit.name}</span>
                        <span className="block truncate text-[12px] text-muted">{describeHabit(habit)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="num text-muted">{streak > 0 ? formatPeriods(habit, streak) : "—"}</td>
                  <td className="num"><HabitControl habit={habit} date={today.date} count={counts.get(today.date) ?? 0} weekTotal={weekTotal(counts, today.date)} size="sm" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
