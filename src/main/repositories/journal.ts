import type { SoulDatabase } from "../database/open";
import { nowIso } from "../database/ids";
import { containsPattern } from "../database/like";
import { foldText } from "@shared/text";
import type { IsoDate } from "@shared/contracts/common";
import type { JournalEntry, JournalInput, Rating } from "@shared/contracts/journal";

interface JournalRow {
  date: string;
  mood: number | null;
  energy: number | null;
  note: string;
  updated_at: string;
}

export interface JournalRepository {
  readonly get: (date: IsoDate) => JournalEntry | null;
  readonly list: (from: IsoDate, to: IsoDate) => JournalEntry[];
  readonly save: (input: JournalInput) => JournalEntry | null;
  readonly search: (text: string, limit: number) => JournalEntry[];
}

function toEntry(row: JournalRow): JournalEntry {
  return {
    date: row.date,
    mood: row.mood as Rating | null,
    energy: row.energy as Rating | null,
    note: row.note,
    updatedAt: row.updated_at,
  };
}

export function createJournalRepository(database: SoulDatabase): JournalRepository {
  const selectOne = database.prepare<[string], JournalRow>("SELECT * FROM journal_entries WHERE date = ?");
  const selectRange = database.prepare<[string, string], JournalRow>("SELECT * FROM journal_entries WHERE date >= ? AND date <= ? ORDER BY date");
  const selectMatching = database.prepare<[string, number], JournalRow>("SELECT * FROM journal_entries WHERE soul_fold(note) LIKE ? ESCAPE '\\' ORDER BY date DESC LIMIT ?");
  const upsert = database.prepare<[string, number | null, number | null, string, string]>(
    `INSERT INTO journal_entries (date, mood, energy, note, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, energy = excluded.energy, note = excluded.note, updated_at = excluded.updated_at`,
  );
  const deleteOne = database.prepare<[string]>("DELETE FROM journal_entries WHERE date = ?");

  function get(date: IsoDate): JournalEntry | null {
    const row = selectOne.get(date);
    return row ? toEntry(row) : null;
  }

  return {
    get,
    list: (from, to) => selectRange.all(from, to).map(toEntry),
    save(input) {
      const current = get(input.date);
      const mood = input.mood === undefined ? (current?.mood ?? null) : input.mood;
      const energy = input.energy === undefined ? (current?.energy ?? null) : input.energy;
      const typed = input.note ?? current?.note ?? "";
      const note = typed.trim().length === 0 ? "" : typed;
      if (mood === null && energy === null && note.length === 0) {
        deleteOne.run(input.date);
        return null;
      }
      upsert.run(input.date, mood, energy, note, nowIso());
      return get(input.date);
    },
    search(text, limit) {
      const needle = text.trim();
      if (needle.length === 0) return [];
      return selectMatching.all(containsPattern(foldText(needle)), limit).map(toEntry);
    },
  };
}
