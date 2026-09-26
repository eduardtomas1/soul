import { clsx } from "clsx";
import { useState } from "react";
import type { IsoDate } from "@shared/contracts/common";
import type { Routine, RoutineDay } from "@shared/contracts/routines";
import { invoke } from "@/lib/bridge";
import { useToasts } from "@/lib/toasts";
import { CheckMark } from "@/components/check-mark";

export function RoutineChecklist({ routine, day, date, compact }: { routine: Routine; day: RoutineDay | undefined; date: IsoDate; compact?: boolean }) {
  const { celebrate, push } = useToasts();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const completed = new Set(day?.completedStepIds ?? []);
  const [doneAtStart] = useState(() => new Set(completed));

  const toggle = async (stepId: string) => {
    const next = !(optimistic[stepId] ?? completed.has(stepId));
    setOptimistic((current) => ({ ...current, [stepId]: next }));
    const result = await invoke("routines.setStep", { routineId: routine.id, stepId, date, completed: next }).catch((error: unknown) => {
      push({ title: "Could not save", description: error instanceof Error ? error.message : undefined, tone: "danger" });
      return null;
    });
    setOptimistic((current) => {
      const { [stepId]: _removed, ...rest } = current;
      return rest;
    });
    if (result && result.newMedals.length > 0) celebrate(result.newMedals);
  };

  return (
    <ul className="flex flex-col">
      {routine.steps.map((step) => {
        const done = optimistic[step.id] ?? completed.has(step.id);
        return (
          <li key={step.id}>
            <button
              type="button"
              aria-pressed={done}
              onClick={() => void toggle(step.id)}
              className={clsx("group flex w-full items-center gap-3 rounded-[7px] px-2.5 text-left transition-colors hover:bg-surface-2", compact ? "h-9" : "h-10")}
            >
              <span key={done ? "done" : "open"} className={clsx("flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors", done ? "border-accent bg-accent text-accent-text" : "border-border-strong group-hover:border-muted", done && !doneAtStart.has(step.id) && "pop")}>
                {done && <CheckMark size={11} animate={!doneAtStart.has(step.id)} />}
              </span>
              <span className={clsx("min-w-0 flex-1 truncate text-[13px]", done && "text-muted line-through decoration-border-strong")}>{step.name}</span>
              {step.durationMinutes !== null && <span className="text-[12px] text-faint tabular-nums">{step.durationMinutes} min</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
