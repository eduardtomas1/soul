import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { IsoDate } from "@shared/contracts/common";
import type { JournalEntry } from "@shared/contracts/journal";
import { foldedIndex } from "@shared/text";
import { invoke, subscribe } from "@/lib/bridge";
import { formatWeekdayDate } from "@/lib/format";
import { Panel, inputClass } from "@/components/primitives";
import { RatingMeter } from "./rating";

const DEBOUNCE = 220;
const CONTEXT = 70;

function excerpt(note: string, needle: string): { before: string; match: string; after: string } {
  const found = foldedIndex(note, needle);
  if (!found) return { before: note.slice(0, CONTEXT * 2), match: "", after: "" };
  const start = Math.max(0, found.start - CONTEXT);
  return {
    before: `${start > 0 ? "…" : ""}${note.slice(start, found.start)}`,
    match: note.slice(found.start, found.end),
    after: `${note.slice(found.end, found.end + CONTEXT)}${found.end + CONTEXT < note.length ? "…" : ""}`,
  };
}

export function JournalSearch({ onSelect }: { onSelect: (date: IsoDate) => void }) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<{ needle: string; entries: JournalEntry[] } | null>(null);
  const needle = text.trim();
  const results = needle.length > 0 && found?.needle === needle ? found.entries : null;
  const [version, setVersion] = useState(0);

  useEffect(() => subscribe<{ scope: string }>("data.changed", ({ scope }) => {
    if (scope === "journal" || scope === "all") setVersion((current) => current + 1);
  }), []);

  useEffect(() => {
    if (needle.length === 0) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      invoke("journal.search", { text: needle }).then((entries) => {
        if (!cancelled) setFound({ needle, entries });
      }).catch(() => {
        if (!cancelled) setFound({ needle, entries: [] });
      });
    }, DEBOUNCE);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [needle, version]);

  return (
    <Panel title="Search notes" meta={results ? `${results.length} found` : undefined}>
      <div className="p-3">
        <div className="relative">
          <MagnifyingGlass size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Find a word in any entry" aria-label="Search journal notes" className={`${inputClass} pr-8 pl-8`} />
          {text && <button type="button" aria-label="Clear search" onClick={() => setText("")} className="absolute top-1/2 right-2 -translate-y-1/2 text-faint hover:text-text"><X size={13} /></button>}
        </div>
      </div>
      {results && (
        results.length === 0 ? (
          <div className="border-t border-border px-5 py-5 text-[12.5px] text-muted">No entries mention “{needle}”.</div>
        ) : (
          <ul className="max-h-[320px] divide-y divide-border overflow-y-auto border-t border-border">
            {results.map((entry) => {
              const part = excerpt(entry.note, needle);
              return (
                <li key={entry.date}>
                  <button type="button" onClick={() => onSelect(entry.date)} className="flex w-full flex-col gap-1 px-5 py-3 text-left transition-colors hover:bg-surface-2">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold">{formatWeekdayDate(entry.date)} {entry.date.slice(0, 4)}</span>
                      <RatingMeter value={entry.mood} label="Mood" />
                    </span>
                    <span className="line-clamp-2 text-[12.5px] text-muted">
                      {part.before}
                      {part.match && <mark className="rounded-[2px] bg-signal-soft px-0.5 text-text">{part.match}</mark>}
                      {part.after}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}
    </Panel>
  );
}
