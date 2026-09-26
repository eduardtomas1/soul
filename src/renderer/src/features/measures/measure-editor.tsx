import { useState } from "react";
import type { ColorToken } from "@shared/contracts/common";
import type { Measure, MeasureDirection, MeasureInput } from "@shared/contracts/measures";
import { DEFAULT_MEASURE_ICON } from "@shared/icons";
import { formatMeasureInput, parseMeasureInput } from "@shared/measures";
import { useMutation } from "@/lib/query";
import { Field, InlineError, Segmented, TextInput } from "@/components/primitives";
import { IconAndColor } from "@/components/icon-and-color";
import { Sheet, SheetActions } from "@/components/sheet";

type Decimals = "0" | "1" | "2" | "3";
const DECIMALS: ReadonlyArray<{ value: Decimals; label: string }> = [
  { value: "0", label: "1" },
  { value: "1", label: "0,1" },
  { value: "2", label: "0,01" },
  { value: "3", label: "0,001" },
];

const DIRECTIONS: ReadonlyArray<{ value: MeasureDirection; label: string }> = [
  { value: "up", label: "Higher" },
  { value: "down", label: "Lower" },
  { value: "none", label: "Neither" },
];

interface Draft {
  name: string;
  unit: string;
  icon: string;
  color: ColorToken;
  decimals: Decimals;
  target: string;
  direction: MeasureDirection;
}

function draftFrom(measure: Measure | null): Draft {
  if (!measure) return { name: "", unit: "", icon: DEFAULT_MEASURE_ICON, color: "sky", decimals: "1", target: "", direction: "none" };
  return {
    name: measure.name,
    unit: measure.unit ?? "",
    icon: measure.icon,
    color: measure.color,
    decimals: String(measure.decimals) as Decimals,
    target: measure.target === null ? "" : formatMeasureInput(measure.target, measure.decimals),
    direction: measure.direction,
  };
}

export function MeasureEditor({ measure, open, onClose }: { measure: Measure | null; open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(measure));
  const [validation, setValidation] = useState<string | null>(null);
  const create = useMutation("measures.create");
  const update = useMutation("measures.update");
  const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));

  const save = async () => {
    if (draft.name.trim().length === 0) return setValidation("Give the measure a name.");
    const target = draft.target.trim().length === 0 ? null : parseMeasureInput(draft.target, Number(draft.decimals));
    if (draft.target.trim().length > 0 && target === null) return setValidation("The target must be a number, like 72 or 7,5.");
    setValidation(null);
    const input: MeasureInput = { name: draft.name.trim(), unit: draft.unit.trim() || null, icon: draft.icon, color: draft.color, decimals: Number(draft.decimals), target, direction: draft.direction };
    const saved = measure ? await update.run({ id: measure.id, input }) : await create.run(input);
    if (saved) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={measure ? "Edit measure" : "New measure"}
      description="Any number you want to follow over time, one value per day."
      footer={<SheetActions onCancel={onClose} onSave={() => void save()} saving={create.pending || update.pending} saveLabel={measure ? "Save changes" : "Create measure"} />}
    >
      <IconAndColor icon={draft.icon} color={draft.color} onIcon={(icon) => patch({ icon })} onColor={(color) => patch({ color })}>
        <Field label="Name">
          <TextInput autoFocus value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Weight" maxLength={120} />
        </Field>
      </IconAndColor>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Unit" hint="kg, h, bpm… or leave empty">
          <TextInput value={draft.unit} onChange={(event) => patch({ unit: event.target.value })} placeholder="kg" maxLength={24} />
        </Field>
        <Field label="Target" hint="Optional. Drawn as a line on the chart.">
          <TextInput inputMode="decimal" value={draft.target} onChange={(event) => patch({ target: event.target.value })} placeholder="72" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Better when" group hint="Colours the change green or red.">
          <Segmented value={draft.direction} onChange={(direction) => patch({ direction })} options={DIRECTIONS} />
        </Field>
        <Field label="Precision" group hint="Values are rounded to this step.">
          <Segmented value={draft.decimals} onChange={(decimals) => patch({ decimals })} options={DECIMALS} />
        </Field>
      </div>
      <InlineError message={validation ?? create.error ?? update.error} />
    </Sheet>
  );
}
