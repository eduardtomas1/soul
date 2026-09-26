import { clsx } from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IsoDate } from "@shared/contracts/common";
import type { Measure } from "@shared/contracts/measures";
import { formatMeasureInput, parseMeasureInput } from "@shared/measures";
import { invoke } from "@/lib/bridge";
import { useFlushOnExit } from "@/lib/flush";
import { useToasts } from "@/lib/toasts";
import { inputClass } from "@/components/primitives";

function shown(value: number | null, decimals: number): string {
  return value === null ? "" : formatMeasureInput(value, decimals);
}

export function MeasureValueInput({ measure, date, value, className, showUnit = true, label }: { measure: Measure; date: IsoDate; value: number | null; className?: string; showUnit?: boolean; label?: string }) {
  const unit = showUnit ? measure.unit : null;
  const { push } = useToasts();
  const [text, setText] = useState(shown(value, measure.decimals));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);
  const typed = useRef<string | null>(null);

  useEffect(() => {
    if (!focused.current) setText(shown(value, measure.decimals));
  }, [value, measure.decimals]);

  const save = useCallback((raw: string): Promise<number | null> | null => {
    const trimmed = raw.trim();
    const parsed = trimmed.length === 0 ? null : parseMeasureInput(trimmed, measure.decimals);
    if (trimmed.length > 0 && parsed === null) return null;
    if (parsed === value) return Promise.resolve(value);
    return invoke("measures.setEntry", { measureId: measure.id, date, value: parsed }).then((saved) => saved?.value ?? null);
  }, [measure.id, measure.decimals, date, value]);

  const flushTyped = useCallback(() => {
    const raw = typed.current;
    typed.current = null;
    if (raw !== null) void save(raw)?.catch(() => undefined);
  }, [save]);

  useFlushOnExit(flushTyped);
  const flushOnUnmount = useRef(flushTyped);
  useEffect(() => {
    flushOnUnmount.current = flushTyped;
  }, [flushTyped]);
  useEffect(() => () => flushOnUnmount.current(), []);

  const commit = async () => {
    const raw = typed.current;
    typed.current = null;
    if (raw === null) return;
    const pending = save(raw);
    if (pending === null) {
      typed.current = raw;
      setInvalid(true);
      return;
    }
    setInvalid(false);
    try {
      setText(shown(await pending, measure.decimals));
    } catch (error) {
      push({ title: "Could not save", description: error instanceof Error ? error.message : undefined, tone: "danger" });
    }
  };

  return (
    <div className={clsx("relative", className)}>
      <input
        inputMode="decimal"
        value={text}
        placeholder="—"
        aria-label={label ?? `${measure.name}${measure.unit ? ` in ${measure.unit}` : ""}`}
        aria-invalid={invalid}
        className={clsx(inputClass, "text-right tabular-nums", unit ? "pr-10" : "pr-2.5", invalid && "border-danger")}
        onFocus={() => { focused.current = true; }}
        onBlur={() => {
          focused.current = false;
          void commit();
        }}
        onChange={(event) => {
          typed.current = event.target.value;
          setText(event.target.value);
          setInvalid(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            event.preventDefault();
            typed.current = null;
            setInvalid(false);
            setText(shown(value, measure.decimals));
            event.currentTarget.blur();
          }
        }}
      />
      {unit && <span className="pointer-events-none absolute top-1/2 right-2.5 max-w-[40%] -translate-y-1/2 truncate text-[12px] text-faint">{unit}</span>}
    </div>
  );
}
