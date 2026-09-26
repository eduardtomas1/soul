import { Minus, Plus } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useState } from "react";
import type { Habit, HabitEntry } from "@shared/contracts/habits";
import type { IsoDate } from "@shared/contracts/common";
import { invoke } from "@/lib/bridge";
import { useToasts } from "@/lib/toasts";
import { CheckMark } from "@/components/check-mark";

export function HabitControl({ habit, date, count, weekTotal, size = "md" }: { habit: Habit; date: IsoDate; count: number; weekTotal?: number; size?: "sm" | "md" }) {
  const { celebrate, push } = useToasts();
  const [optimistic, setOptimistic] = useState<number | null>(null);
  const current = optimistic ?? count;
  const target = habit.targetCount;
  const progressBase = habit.cadence === "weekly" ? (weekTotal ?? 0) - count + current : current;
  const done = progressBase >= target;
  const [start] = useState(() => ({ checked: count > 0, progress: progressBase }));
  const fresh = current > 0 && !start.checked;

  const save = async (next: number) => {
    setOptimistic(next);
    const result = await invoke("habits.setEntry", { habitId: habit.id, date, count: next } satisfies HabitEntry).catch((error: unknown) => {
      push({ title: "Could not save", description: error instanceof Error ? error.message : undefined, tone: "danger" });
      return null;
    });
    setOptimistic(null);
    if (result && result.newMedals.length > 0) celebrate(result.newMedals);
  };

  if (habit.kind === "check") {
    return (
      <button
        type="button"
        aria-pressed={current > 0}
        aria-label={current > 0 ? `Undo ${habit.name}` : `Complete ${habit.name}`}
        onClick={() => void save(current > 0 ? 0 : 1)}
        className={clsx("inline-flex shrink-0 items-center justify-center rounded-[5px] border transition-colors", size === "sm" ? "h-5 w-5" : "h-6 w-6", current > 0 ? "border-accent bg-accent text-accent-text" : "border-border-strong hover:border-muted")}
      >
        <span key={current > 0 ? "done" : "open"} className={clsx("inline-flex", fresh && "pop")}>
          {current > 0 && <CheckMark size={size === "sm" ? 12 : 14} animate={fresh} />}
        </span>
      </button>
    );
  }

  const button = "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border border-border-strong text-muted transition-colors hover:text-text disabled:opacity-30";
  return (
    <div className="inline-flex items-center gap-1">
      <button type="button" aria-label={`Decrease ${habit.name}`} disabled={current <= 0} onClick={() => void save(Math.max(0, current - 1))} className={button}>
        <Minus size={12} weight="bold" />
      </button>
      <span className={clsx("min-w-[48px] text-center text-[12.5px] tabular-nums", done ? "font-semibold text-text" : "text-muted")}>
        <span key={progressBase} className={progressBase !== start.progress ? "bump" : undefined}>{progressBase}</span>
        <span className="text-faint">/{target}</span>
      </span>
      <button type="button" aria-label={`Increase ${habit.name}`} onClick={() => void save(current + 1)} className={button}>
        <Plus size={12} weight="bold" />
      </button>
    </div>
  );
}
