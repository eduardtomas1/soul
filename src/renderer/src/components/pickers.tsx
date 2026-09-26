import { clsx } from "clsx";
import { useMemo, useState } from "react";
import type { ColorToken, Weekday } from "@shared/contracts/common";
import { COLOR_TOKENS } from "@shared/contracts/common";
import { ICON_GROUPS, type IconKey } from "@shared/icons";
import { parseEuroInput, formatCents, formatSignedCents } from "@shared/money";
import { WEEKDAY_LETTERS } from "@/lib/format";
import { GLYPHS } from "@/lib/glyphs";
import { Glyph } from "./glyph";
import { TextInput } from "./primitives";

export function ColorPicker({ value, onChange }: { value: ColorToken; onChange: (value: ColorToken) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
      {COLOR_TOKENS.map((token) => (
        <button
          key={token}
          type="button"
          role="radio"
          aria-checked={token === value}
          aria-label={token}
          onClick={() => onChange(token)}
          className={clsx("h-6 w-6 rounded-[5px]", `tone-${token}`)}
          style={{ background: "var(--tone)", boxShadow: token === value ? "0 0 0 2px var(--surface), 0 0 0 3.5px var(--text)" : undefined }}
        />
      ))}
    </div>
  );
}

export function IconPicker({ value, onChange, tone }: { value: string; onChange: (value: IconKey) => void; tone: ColorToken }) {
  const [filter, setFilter] = useState("");
  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const seen = new Set<unknown>();
    return ICON_GROUPS.map((group) => ({
      ...group,
      keys: group.keys.filter((key) => {
        if (needle && !key.includes(needle)) return false;
        if (seen.has(GLYPHS[key]) && key !== value) return false;
        seen.add(GLYPHS[key]);
        return true;
      }),
    })).filter((group) => group.keys.length > 0);
  }, [filter, value]);
  return (
    <div className="flex flex-col gap-3">
      <TextInput value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search icons" aria-label="Search icons" />
      <div className="max-h-[240px] overflow-y-auto pr-1 flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 text-[11.5px] text-faint">{group.label}</div>
            <div className="grid grid-cols-9 gap-1">
              {group.keys.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={key.replace(/-/gu, " ")}
                  aria-pressed={key === value}
                  onClick={() => onChange(key)}
                  className={clsx("flex h-8 w-8 items-center justify-center rounded-[6px] border transition-colors", `tone-${tone}`, key === value ? "border-text text-[var(--tone)]" : "border-transparent text-muted hover:bg-surface-2 hover:text-text")}
                >
                  <Glyph name={key} size={17} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeekdayPicker({ value, onChange }: { value: readonly Weekday[]; onChange: (value: Weekday[]) => void; tone?: ColorToken }) {
  const toggle = (day: Weekday) => {
    const next = value.includes(day) ? value.filter((entry) => entry !== day) : [...value, day];
    onChange([...next].sort((a, b) => a - b));
  };
  return (
    <div className="flex gap-1.5" role="group" aria-label="Days of the week">
      {WEEKDAY_LETTERS.map((letter, index) => {
        const day = index as Weekday;
        const active = value.includes(day);
        return (
          <button
            key={index}
            type="button"
            aria-pressed={active}
            aria-label={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index]}
            onClick={() => toggle(day)}
            className={clsx("h-7 w-7 rounded-[6px] border text-[12px] font-medium transition-colors", active ? "border-accent bg-accent text-accent-text" : "border-border-strong bg-surface text-muted hover:text-text")}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}

export function MoneyInput({ valueCents, onChange, placeholder, allowNegative = true, className, autoFocus }: { valueCents: number | null; onChange: (cents: number | null) => void; placeholder?: string; allowNegative?: boolean; className?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(() => (valueCents === null ? "" : (valueCents / 100).toFixed(2).replace(".", ",")));
  const [touched, setTouched] = useState(false);
  const parsed = parseEuroInput(text);
  const invalid = touched && text.trim().length > 0 && (parsed === null || (!allowNegative && parsed < 0));
  return (
    <div className={clsx("relative", className)}>
      <TextInput
        inputMode="decimal"
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder ?? "0,00"}
        aria-invalid={invalid}
        className={clsx("pr-8 tabular-nums", invalid && "border-danger")}
        onChange={(event) => {
          setText(event.target.value);
          const cents = parseEuroInput(event.target.value);
          onChange(cents !== null && (allowNegative || cents >= 0) ? cents : null);
        }}
        onBlur={() => {
          setTouched(true);
          if (parsed !== null) setText((parsed / 100).toFixed(2).replace(".", ","));
        }}
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-faint">€</span>
    </div>
  );
}

export function Amount({ cents, className, signed = false, muted }: { cents: number; className?: string; signed?: boolean; muted?: boolean }) {
  const tone = signed && !muted && cents !== 0 && (cents < 0 ? "text-text" : "text-success");
  return <span className={clsx("whitespace-nowrap tabular-nums", tone, className)}>{signed ? formatSignedCents(cents) : formatCents(cents)}</span>;
}
