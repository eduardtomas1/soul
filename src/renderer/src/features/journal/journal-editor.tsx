import { useCallback, useEffect, useRef, useState } from "react";
import type { IsoDate } from "@shared/contracts/common";
import type { JournalEntry, JournalInput, Rating } from "@shared/contracts/journal";
import { invoke } from "@/lib/bridge";
import { useFlushOnExit } from "@/lib/flush";
import { TextArea } from "@/components/primitives";
import { ENERGY_LABELS, MOOD_LABELS, RatingPicker } from "./rating";

const TYPING_DELAY = 700;

export type SaveState = "idle" | "saving" | "saved" | "error";
type Changes = Omit<JournalInput, "date">;
type Field = keyof Changes;

export function SaveStatus({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return <span className="fade text-[12px] text-muted" aria-live="polite">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : <span className="text-danger">Not saved</span>}</span>;
}

export function JournalEditor({ date, entry, rows = 5, autoFocus = false, onStateChange }: { date: IsoDate; entry: JournalEntry | null; rows?: number; autoFocus?: boolean; onStateChange?: (state: SaveState, date: IsoDate) => void }) {
  const [mood, setMood] = useState<Rating | null>(entry?.mood ?? null);
  const [energy, setEnergy] = useState<Rating | null>(entry?.energy ?? null);
  const [note, setNote] = useState(entry?.note ?? "");
  const [dirty, setDirty] = useState<ReadonlySet<Field>>(() => new Set());
  const [inFlight, setInFlight] = useState(0);
  const [adopted, setAdopted] = useState(entry?.updatedAt ?? null);
  const pending = useRef<Changes>({});
  const timer = useRef<number | undefined>(undefined);

  const incoming = entry?.updatedAt ?? null;
  if (incoming !== adopted && inFlight === 0) {
    setAdopted(incoming);
    if (!dirty.has("mood")) setMood(entry?.mood ?? null);
    if (!dirty.has("energy")) setEnergy(entry?.energy ?? null);
    if (!dirty.has("note")) setNote(entry?.note ?? "");
  }

  const report = useCallback((state: SaveState) => onStateChange?.(state, date), [onStateChange, date]);

  const persist = useCallback(async () => {
    window.clearTimeout(timer.current);
    const changes = pending.current;
    if (Object.keys(changes).length === 0) return;
    pending.current = {};
    setDirty(new Set());
    setInFlight((count) => count + 1);
    report("saving");
    try {
      await invoke("journal.save", { date, ...changes });
      report("saved");
    } catch {
      pending.current = { ...changes, ...pending.current };
      setDirty(new Set(Object.keys(pending.current) as Field[]));
      report("error");
    } finally {
      setInFlight((count) => count - 1);
    }
  }, [date, report]);

  const flushNow = useCallback(() => {
    window.clearTimeout(timer.current);
    const unsaved = pending.current;
    pending.current = {};
    if (Object.keys(unsaved).length > 0) void invoke("journal.save", { date, ...unsaved }).catch(() => undefined);
  }, [date]);

  useFlushOnExit(flushNow);
  useEffect(() => flushNow, [flushNow]);

  const change = (changes: Changes, delay: number) => {
    pending.current = { ...pending.current, ...changes };
    setDirty((current) => new Set([...current, ...(Object.keys(changes) as Field[])]));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void persist(), delay);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-5">
        <RatingPicker label="Mood" labels={MOOD_LABELS} value={mood} onChange={(value) => { setMood(value); change({ mood: value }, 0); }} />
        <RatingPicker label="Energy" labels={ENERGY_LABELS} value={energy} onChange={(value) => { setEnergy(value); change({ energy: value }, 0); }} />
      </div>
      <TextArea
        aria-label="Journal note"
        rows={rows}
        autoFocus={autoFocus}
        value={note}
        maxLength={20_000}
        placeholder="What happened today? What is on your mind?"
        className="leading-relaxed"
        onChange={(event) => { setNote(event.target.value); change({ note: event.target.value }, TYPING_DELAY); }}
        onBlur={() => void persist()}
      />
    </div>
  );
}
