import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import type { ColorToken, Weekday } from "@shared/contracts/common";
import type { Routine, RoutineInput, RoutineStepInput } from "@shared/contracts/routines";
import { DEFAULT_ROUTINE_ICON } from "@shared/icons";
import { useMutation } from "@/lib/query";
import { Button, Field, IconButton, InlineError, TextInput, Toggle } from "@/components/primitives";
import { WeekdayPicker } from "@/components/pickers";
import { IconAndColor } from "@/components/icon-and-color";
import { Sheet, SheetActions } from "@/components/sheet";

const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

interface Draft {
  name: string;
  icon: string;
  color: ColorToken;
  timeOfDay: string;
  weekdays: Weekday[];
  remind: boolean;
  remindAt: string;
  steps: Array<RoutineStepInput & { key: string }>;
}

function draftFrom(routine: Routine | null): Draft {
  if (!routine) {
    return { name: "", icon: DEFAULT_ROUTINE_ICON, color: "amber", timeOfDay: "07:30", weekdays: ALL_DAYS, remind: false, remindAt: "07:30", steps: [{ key: "s1", name: "", durationMinutes: null }] };
  }
  return {
    name: routine.name,
    icon: routine.icon,
    color: routine.color,
    timeOfDay: routine.timeOfDay ?? "",
    weekdays: [...routine.weekdays],
    remind: routine.remindAt !== null,
    remindAt: routine.remindAt ?? routine.timeOfDay ?? "07:30",
    steps: routine.steps.map((step) => ({ key: step.id, id: step.id, name: step.name, durationMinutes: step.durationMinutes })),
  };
}

export function RoutineEditor({ routine, open, onClose, onSaved }: { routine: Routine | null; open: boolean; onClose: () => void; onSaved?: (routine: Routine) => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(routine));
  const create = useMutation("routines.create");
  const update = useMutation("routines.update");
  const [validation, setValidation] = useState<string | null>(null);

  const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));
  const patchStep = (key: string, changes: Partial<RoutineStepInput>) => patch({ steps: draft.steps.map((step) => (step.key === key ? { ...step, ...changes } : step)) });
  const moveStep = (key: string, direction: -1 | 1) => {
    const index = draft.steps.findIndex((step) => step.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= draft.steps.length) return;
    const steps = [...draft.steps];
    const [moved] = steps.splice(index, 1);
    if (moved) steps.splice(target, 0, moved);
    patch({ steps });
  };

  const save = async () => {
    const steps = draft.steps.filter((step) => step.name.trim().length > 0);
    if (draft.name.trim().length === 0) return setValidation("Give the routine a name.");
    if (steps.length === 0) return setValidation("Add at least one step.");
    if (draft.weekdays.length === 0) return setValidation("Choose at least one day.");
    setValidation(null);
    const input: RoutineInput = {
      name: draft.name.trim(),
      icon: draft.icon,
      color: draft.color,
      timeOfDay: draft.timeOfDay.length > 0 ? draft.timeOfDay : null,
      weekdays: draft.weekdays,
      remindAt: draft.remind && draft.remindAt.length > 0 ? draft.remindAt : null,
      steps: steps.map((step) => ({ ...(step.id ? { id: step.id } : {}), name: step.name.trim(), durationMinutes: step.durationMinutes })),
    };
    const saved = routine ? await update.run({ id: routine.id, input }) : await create.run(input);
    if (saved) {
      onSaved?.(saved);
      onClose();
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={routine ? "Edit routine" : "New routine"}
      description="An ordered block of steps you run through at a time of day."
      footer={<SheetActions onCancel={onClose} onSave={() => void save()} saving={create.pending || update.pending} saveLabel={routine ? "Save changes" : "Create routine"} />}
    >
      <IconAndColor icon={draft.icon} color={draft.color} onIcon={(icon) => patch({ icon })} onColor={(color) => patch({ color })}>
        <Field label="Name">
          <TextInput autoFocus value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Morning routine" />
        </Field>
      </IconAndColor>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Time of day" hint="Leave empty for any time.">
          <TextInput type="time" value={draft.timeOfDay} onChange={(event) => patch({ timeOfDay: event.target.value })} />
        </Field>
        <Field label="Days" group>
          <WeekdayPicker value={draft.weekdays} tone={draft.color} onChange={(weekdays) => patch({ weekdays })} />
        </Field>
      </div>
      <div className="card px-4 py-1">
        <Toggle checked={draft.remind} onChange={(remind) => patch({ remind })} label="Remind me" description="A desktop notification when it is time." />
        {draft.remind && (
          <div className="pb-3">
            <TextInput type="time" value={draft.remindAt} onChange={(event) => patch({ remindAt: event.target.value })} className="w-36" aria-label="Reminder time" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-muted">Steps</span>
          <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => patch({ steps: [...draft.steps, { key: `s${Date.now()}`, name: "", durationMinutes: null }] })}>Add step</Button>
        </div>
        <ol className="flex flex-col gap-2">
          {draft.steps.map((step, index) => (
            <li key={step.key} className="flex items-center gap-2">
              <span className="w-5 text-[12px] text-faint tabular-nums text-right">{index + 1}</span>
              <TextInput value={step.name} onChange={(event) => patchStep(step.key, { name: event.target.value })} placeholder="Step" className="flex-1" onKeyDown={(event) => {
                if (event.key === "Enter" && index === draft.steps.length - 1) patch({ steps: [...draft.steps, { key: `s${Date.now()}`, name: "", durationMinutes: null }] });
              }} />
              <TextInput type="number" min={1} max={1440} value={step.durationMinutes ?? ""} onChange={(event) => patchStep(step.key, { durationMinutes: event.target.value ? Number(event.target.value) : null })} placeholder="min" className="w-[68px] text-center" aria-label="Minutes" />
              <IconButton label="Move up" size="sm" disabled={index === 0} onClick={() => moveStep(step.key, -1)}><ArrowUp size={13} /></IconButton>
              <IconButton label="Move down" size="sm" disabled={index === draft.steps.length - 1} onClick={() => moveStep(step.key, 1)}><ArrowDown size={13} /></IconButton>
              <IconButton label="Remove step" size="sm" disabled={draft.steps.length === 1} onClick={() => patch({ steps: draft.steps.filter((entry) => entry.key !== step.key) })}><Trash size={13} /></IconButton>
            </li>
          ))}
        </ol>
      </div>
      <InlineError message={validation ?? create.error ?? update.error} />
    </Sheet>
  );
}
