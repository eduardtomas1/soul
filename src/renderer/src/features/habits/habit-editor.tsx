import { useState } from "react";
import type { ColorToken, Weekday } from "@shared/contracts/common";
import type { Habit, HabitInput } from "@shared/contracts/habits";
import { DEFAULT_HABIT_ICON } from "@shared/icons";
import { useMutation } from "@/lib/query";
import { Field, InlineError, Segmented, TextInput, Toggle } from "@/components/primitives";
import { WeekdayPicker } from "@/components/pickers";
import { IconAndColor } from "@/components/icon-and-color";
import { Sheet, SheetActions } from "@/components/sheet";

const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

interface Draft {
  name: string;
  icon: string;
  color: ColorToken;
  kind: Habit["kind"];
  targetCount: number;
  unit: string;
  cadence: Habit["cadence"];
  weekdays: Weekday[];
  remind: boolean;
  remindAt: string;
}

function draftFrom(habit: Habit | null): Draft {
  if (!habit) return { name: "", icon: DEFAULT_HABIT_ICON, color: "mint", kind: "check", targetCount: 1, unit: "", cadence: "daily", weekdays: ALL_DAYS, remind: false, remindAt: "20:00" };
  return { name: habit.name, icon: habit.icon, color: habit.color, kind: habit.kind, targetCount: habit.targetCount, unit: habit.unit ?? "", cadence: habit.cadence, weekdays: [...habit.weekdays], remind: habit.remindAt !== null, remindAt: habit.remindAt ?? "20:00" };
}

export function HabitEditor({ habit, open, onClose }: { habit: Habit | null; open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(habit));
  const [validation, setValidation] = useState<string | null>(null);
  const create = useMutation("habits.create");
  const update = useMutation("habits.update");
  const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));

  const save = async () => {
    if (draft.name.trim().length === 0) return setValidation("Give the habit a name.");
    if (draft.cadence === "daily" && draft.weekdays.length === 0) return setValidation("Choose at least one day.");
    if (draft.kind === "count" && (!Number.isInteger(draft.targetCount) || draft.targetCount < 1)) return setValidation("The target must be a whole number of at least 1.");
    setValidation(null);
    const input: HabitInput = {
      name: draft.name.trim(),
      icon: draft.icon,
      color: draft.color,
      kind: draft.kind,
      targetCount: draft.kind === "check" ? 1 : draft.targetCount,
      unit: draft.kind === "count" && draft.unit.trim().length > 0 ? draft.unit.trim() : null,
      cadence: draft.cadence,
      weekdays: draft.cadence === "daily" ? draft.weekdays : ALL_DAYS,
      remindAt: draft.remind && draft.remindAt.length > 0 ? draft.remindAt : null,
    };
    const saved = habit ? await update.run({ id: habit.id, input }) : await create.run(input);
    if (saved) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={habit ? "Edit habit" : "New habit"}
      description="A small target you want to keep, with a streak to protect."
      footer={<SheetActions onCancel={onClose} onSave={() => void save()} saving={create.pending || update.pending} saveLabel={habit ? "Save changes" : "Create habit"} />}
    >
      <IconAndColor icon={draft.icon} color={draft.color} onIcon={(icon) => patch({ icon })} onColor={(color) => patch({ color })}>
        <Field label="Name">
          <TextInput autoFocus value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Read before bed" />
        </Field>
      </IconAndColor>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type" group>
          <Segmented value={draft.kind} onChange={(kind) => patch({ kind })} options={[{ value: "check", label: "Done or not" }, { value: "count", label: "Count" }]} />
        </Field>
        <Field label="Cadence" group>
          <Segmented value={draft.cadence} onChange={(cadence) => patch({ cadence })} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />
        </Field>
      </div>
      {draft.kind === "count" && (
        <div className="grid grid-cols-2 gap-4">
          <Field label={draft.cadence === "daily" ? "Target per day" : "Target per week"}>
            <TextInput type="number" min={1} max={10000} value={draft.targetCount} onChange={(event) => patch({ targetCount: Number(event.target.value) })} />
          </Field>
          <Field label="Unit" hint="Pages, minutes, glasses…">
            <TextInput value={draft.unit} onChange={(event) => patch({ unit: event.target.value })} placeholder="pages" maxLength={24} />
          </Field>
        </div>
      )}
      {draft.cadence === "daily" ? (
        <Field label="Days" group>
          <WeekdayPicker value={draft.weekdays} tone={draft.color} onChange={(weekdays) => patch({ weekdays })} />
        </Field>
      ) : (
        <p className="text-[12.5px] text-muted">Weekly habits count everything you log from Monday to Sunday against the target.</p>
      )}
      <div className="card px-4 py-1">
        <Toggle checked={draft.remind} onChange={(remind) => patch({ remind })} label="Remind me" description="A desktop notification if it is still open at this time." />
        {draft.remind && (
          <div className="pb-3">
            <TextInput type="time" value={draft.remindAt} onChange={(event) => patch({ remindAt: event.target.value })} className="w-36" aria-label="Reminder time" />
          </div>
        )}
      </div>
      <InlineError message={validation ?? create.error ?? update.error} />
    </Sheet>
  );
}
