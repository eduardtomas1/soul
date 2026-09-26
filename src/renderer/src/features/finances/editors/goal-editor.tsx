import { useState } from "react";
import type { ColorToken } from "@shared/contracts/common";
import type { SavingsGoal, SavingsGoalInput } from "@shared/contracts/finances";
import { DEFAULT_GOAL_ICON } from "@shared/icons";
import { useMutation } from "@/lib/query";
import { Button, Field, InlineError, TextInput } from "@/components/primitives";
import { MoneyInput } from "@/components/pickers";
import { IconAndColor } from "@/components/icon-and-color";
import { Sheet, SheetActions } from "@/components/sheet";

export function GoalEditor({ goal, open, onClose }: { goal: SavingsGoal | null; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? "");
  const [icon, setIcon] = useState<string>(goal?.icon ?? DEFAULT_GOAL_ICON);
  const [color, setColor] = useState<ColorToken>(goal?.color ?? "mint");
  const [target, setTarget] = useState<number | null>(goal?.targetCents ?? null);
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [validation, setValidation] = useState<string | null>(null);
  const create = useMutation("finances.goals.create");
  const update = useMutation("finances.goals.update");
  const remove = useMutation("finances.goals.delete");
  const save = async () => {
    if (name.trim().length === 0) return setValidation("Give the goal a name.");
    if (target === null || target <= 0) return setValidation("Enter a target above zero.");
    setValidation(null);
    const input: SavingsGoalInput = { name: name.trim(), icon, color, targetCents: target, targetDate: targetDate || null };
    const saved = goal ? await update.run({ id: goal.id, input }) : await create.run(input);
    if (saved) onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={goal ? "Edit goal" : "New savings goal"}
      footer={<SheetActions leading={goal && <Button variant="danger" onClick={() => void remove.run({ id: goal.id }).then(onClose)}>Delete</Button>} onCancel={onClose} onSave={() => void save()} saving={create.pending || update.pending} saveLabel={goal ? "Save" : "Create"} />}
    >
      <IconAndColor icon={icon} color={color} onIcon={setIcon} onColor={setColor}>
        <Field label="Name"><TextInput autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Emergency fund" /></Field>
      </IconAndColor>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Target"><MoneyInput valueCents={target} onChange={setTarget} allowNegative={false} /></Field>
        <Field label="By" hint="Optional."><TextInput type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></Field>
      </div>
      <InlineError message={validation ?? create.error ?? update.error ?? remove.error} />
    </Sheet>
  );
}
