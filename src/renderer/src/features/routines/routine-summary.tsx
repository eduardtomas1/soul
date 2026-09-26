import type { DaySummary } from "@shared/contracts/journal";
import type { Routine, RoutineDay } from "@shared/contracts/routines";
import { isScheduledOn, weekdaysToMask } from "@shared/dates";
import { KpiGrid, formatCount } from "@/components/kpi";

export function RoutineSummary({ routines, days, dayStates, date }: { routines: readonly Routine[]; days: readonly DaySummary[]; dayStates: ReadonlyMap<string, RoutineDay>; date: string }) {
  const today = days[days.length - 1];
  const scheduled = routines.filter((routine) => isScheduledOn(weekdaysToMask(routine.weekdays), date));
  const steps = scheduled.reduce((sum, routine) => sum + routine.steps.length, 0);
  const stepsDone = scheduled.reduce((sum, routine) => sum + (dayStates.get(routine.id)?.completedStepIds.length ?? 0), 0);
  const withDue = days.filter((day) => day.routinesDue > 0);
  const due = withDue.reduce((sum, day) => sum + day.routinesDue, 0);
  const done = withDue.reduce((sum, day) => sum + day.routinesDone, 0);
  const perfect = withDue.filter((day) => day.routinesDone >= day.routinesDue).length;
  const rates = withDue.map((day) => day.routinesDone / day.routinesDue);
  return (
    <KpiGrid
      items={[
        { label: "Done today", value: today?.routinesDone ?? 0, format: formatCount, suffix: `/ ${today?.routinesDue ?? 0}`, hint: "routines completed", trend: rates.slice(-14) },
        { label: "Steps today", value: stepsDone, format: formatCount, suffix: `/ ${steps}`, hint: steps === stepsDone && steps > 0 ? "Every step ticked" : `${steps - stepsDone} left`, progress: steps > 0 ? stepsDone / steps : 0 },
        { label: "On schedule, 30 days", value: due > 0 ? Math.round((done / due) * 100) : 0, format: (value) => (due > 0 ? `${Math.round(value)}%` : "—"), hint: `${done} of ${due} scheduled routines`, trend: rates },
        { label: "Perfect days", value: perfect, format: formatCount, suffix: `/ ${withDue.length}`, hint: "every routine done", progress: withDue.length > 0 ? perfect / withDue.length : 0 },
      ]}
    />
  );
}
