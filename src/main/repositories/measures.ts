import type { SoulDatabase } from "../database/open";
import { newId, nowIso } from "../database/ids";
import type { ColorToken, IsoDate } from "@shared/contracts/common";
import type { Measure, MeasureDirection, MeasureEntry, MeasureEntryInput, MeasureInput } from "@shared/contracts/measures";
import { roundMeasure } from "@shared/measures";

interface MeasureRow {
  id: string;
  name: string;
  unit: string | null;
  icon: string;
  color: string;
  decimals: number;
  target: number | null;
  direction: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

interface EntryRow {
  measure_id: string;
  date: string;
  value: number;
}

export interface MeasuresRepository {
  readonly list: () => Measure[];
  readonly get: (id: string) => Measure | null;
  readonly create: (input: MeasureInput) => Measure;
  readonly update: (id: string, input: MeasureInput) => Measure;
  readonly setArchived: (id: string, archived: boolean) => Measure;
  readonly remove: (id: string) => void;
  readonly entries: (from: IsoDate, to: IsoDate) => MeasureEntry[];
  readonly setEntry: (input: MeasureEntryInput) => MeasureEntry | null;
}

function toMeasure(row: MeasureRow): Measure {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    icon: row.icon,
    color: row.color as ColorToken,
    decimals: row.decimals,
    target: row.target,
    direction: row.direction as MeasureDirection,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

function cleanUnit(unit: string | null): string | null {
  const trimmed = unit?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function createMeasuresRepository(database: SoulDatabase): MeasuresRepository {
  const selectAll = database.prepare<[], MeasureRow>("SELECT * FROM measures ORDER BY sort_order, created_at");
  const selectOne = database.prepare<[string], MeasureRow>("SELECT * FROM measures WHERE id = ?");
  const insert = database.prepare<[string, string, string | null, string, string, number, number | null, string, number, string]>(
    "INSERT INTO measures (id, name, unit, icon, color, decimals, target, direction, sort_order, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)",
  );
  const updateRow = database.prepare<[string, string | null, string, string, number, number | null, string, string]>(
    "UPDATE measures SET name = ?, unit = ?, icon = ?, color = ?, decimals = ?, target = ?, direction = ? WHERE id = ?",
  );
  const archive = database.prepare<[string | null, string]>("UPDATE measures SET archived_at = ? WHERE id = ?");
  const deleteRow = database.prepare<[string]>("DELETE FROM measures WHERE id = ?");
  const maxSort = database.prepare<[], { max: number | null }>("SELECT MAX(sort_order) AS max FROM measures");
  const entriesRange = database.prepare<[string, string], EntryRow>("SELECT measure_id, date, value FROM measure_entries WHERE date >= ? AND date <= ? ORDER BY date");
  const upsertEntry = database.prepare<[string, string, number]>(
    "INSERT INTO measure_entries (measure_id, date, value) VALUES (?, ?, ?) ON CONFLICT(measure_id, date) DO UPDATE SET value = excluded.value",
  );
  const deleteEntry = database.prepare<[string, string]>("DELETE FROM measure_entries WHERE measure_id = ? AND date = ?");

  function get(id: string): Measure | null {
    const row = selectOne.get(id);
    return row ? toMeasure(row) : null;
  }

  function requireMeasure(id: string): Measure {
    const measure = get(id);
    if (!measure) throw new Error("Measure not found.");
    return measure;
  }

  return {
    list: () => selectAll.all().map(toMeasure),
    get,
    create(input) {
      const id = newId();
      insert.run(id, input.name, cleanUnit(input.unit), input.icon, input.color, input.decimals, input.target, input.direction, (maxSort.get()?.max ?? -1) + 1, nowIso());
      return requireMeasure(id);
    },
    update(id, input) {
      requireMeasure(id);
      updateRow.run(input.name, cleanUnit(input.unit), input.icon, input.color, input.decimals, input.target, input.direction, id);
      return requireMeasure(id);
    },
    setArchived(id, archived) {
      archive.run(archived ? nowIso() : null, id);
      return requireMeasure(id);
    },
    remove(id) {
      deleteRow.run(id);
    },
    entries: (from, to) => entriesRange.all(from, to).map((row) => ({ measureId: row.measure_id, date: row.date, value: row.value })),
    setEntry({ measureId, date, value }) {
      const measure = requireMeasure(measureId);
      if (value === null) {
        deleteEntry.run(measureId, date);
        return null;
      }
      const rounded = roundMeasure(value, measure.decimals);
      upsertEntry.run(measureId, date, rounded);
      return { measureId, date, value: rounded };
    },
  };
}
