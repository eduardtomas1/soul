import { clsx } from "clsx";
import type { Rating } from "@shared/contracts/journal";

export const MOOD_LABELS = ["Very low", "Low", "Okay", "Good", "Great"] as const;
export const ENERGY_LABELS = ["Drained", "Tired", "Steady", "Energetic", "Charged"] as const;
const LEVELS = [1, 2, 3, 4, 5] as const satisfies readonly Rating[];

export function ratingLabel(value: Rating | null, labels: readonly string[]): string {
  return value === null ? "Not set" : (labels[value - 1] ?? "");
}

export function RatingPicker({ label, value, onChange, labels }: { label: string; value: Rating | null; onChange: (value: Rating | null) => void; labels: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        <span className={clsx("text-[12px] font-medium", value === null ? "text-faint" : "text-text")}>{ratingLabel(value, labels)}</span>
      </div>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1">
        {LEVELS.map((level) => {
          const filled = value !== null && level <= value;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={value === level}
              aria-label={`${label} ${level} of 5, ${labels[level - 1]}`}
              title={labels[level - 1]}
              onClick={() => onChange(value === level ? null : level)}
              className={clsx("h-8 rounded-[6px] border text-[12px] font-semibold tabular-nums transition-[background-color,border-color,color] duration-200", filled ? "border-transparent text-white" : "border-border-strong text-muted hover:border-faint hover:text-text")}
              style={filled ? { background: `color-mix(in oklab, var(--signal) ${40 + level * 12}%, var(--surface))` } : undefined}
            >
              {level}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RatingMeter({ value, label }: { value: Rating | null; label: string }) {
  return (
    <span className="inline-flex items-end gap-[2px]" role="img" aria-label={value === null ? `${label} not set` : `${label} ${value} of 5`}>
      {LEVELS.map((level) => (
        <span
          key={level}
          className="w-[3px] rounded-[1px]"
          style={{ height: 4 + level * 2, background: value !== null && level <= value ? "var(--signal)" : "var(--surface-3)" }}
        />
      ))}
    </span>
  );
}
