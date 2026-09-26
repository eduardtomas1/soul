import type { SoulDatabase } from "../database/open";
import { newId, nowIso } from "../database/ids";
import type { IsoDate } from "@shared/contracts/common";
import type { Habit, HabitEntry, HabitInput, HabitStats, Medal, MedalKind } from "@shared/contracts/habits";
import { localDateOf, maskToWeekdays, weekdaysToMask } from "@shared/dates";
import { computeStreaks } from "@shared/streaks";

interface HabitRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: string;
  target_count: number;
  unit: string | null;
  cadence: string;
  weekdays: number;
  remind_at: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

interface EntryRow {
  habit_id: string;
  date: string;
  count: number;
}

interface MedalRow {
  id: string;
  kind: string;
  subject_kind: string;
  subject_id: string;
  earned_at: string;
  subject_name: string | null;
}

export interface HabitsRepository {
  readonly list: () => Habit[];
  readonly get: (id: string) => Habit | null;
  readonly create: (input: HabitInput) => Habit;
  readonly update: (id: string, input: HabitInput) => Habit;
  readonly setArchived: (id: string, archived: boolean) => Habit;
  readonly remove: (id: string) => void;
  readonly reorder: (ids: readonly string[]) => void;
  readonly entries: (from: IsoDate, to: IsoDate) => HabitEntry[];
  readonly countsFor: (habitId: string) => Map<IsoDate, number>;
  readonly firstEntryDates: () => Map<string, IsoDate>;
  readonly setEntry: (entry: HabitEntry) => HabitEntry;
  readonly stats: (habit: Habit, today: IsoDate) => HabitStats;
  readonly withReminders: () => Habit[];
}

export interface MedalsRepository {
  readonly list: () => Medal[];
  readonly recent: (limit: number) => Medal[];
  readonly award: (kind: MedalKind, subjectKind: Medal["subjectKind"], subjectId: string) => Medal | null;
}

export function trackingStart(createdAt: string, counts: ReadonlyMap<IsoDate, number>, today: IsoDate): IsoDate {
  let start = localDateOf(createdAt);
  for (const date of counts.keys()) if (date < start) start = date;
  return start < today ? start : today;
}

export function createHabitsRepository(database: SoulDatabase): HabitsRepository {
  const selectAll = database.prepare<[], HabitRow>("SELECT * FROM habits ORDER BY sort_order, created_at");
  const selectOne = database.prepare<[string], HabitRow>("SELECT * FROM habits WHERE id = ?");
  const insert = database.prepare<[string, string, string, string, string, number, string | null, string, number, string | null, number, string]>(
    "INSERT INTO habits (id, name, icon, color, kind, target_count, unit, cadence, weekdays, remind_at, sort_order, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)",
  );
  const updateRow = database.prepare<[string, string, string, string, number, string | null, string, number, string | null, string]>(
    "UPDATE habits SET name = ?, icon = ?, color = ?, kind = ?, target_count = ?, unit = ?, cadence = ?, weekdays = ?, remind_at = ? WHERE id = ?",
  );
  const archive = database.prepare<[string | null, string]>("UPDATE habits SET archived_at = ? WHERE id = ?");
  const deleteRow = database.prepare<[string]>("DELETE FROM habits WHERE id = ?");
  const maxSort = database.prepare<[], { max: number | null }>("SELECT MAX(sort_order) AS max FROM habits");
  const setSort = database.prepare<[number, string]>("UPDATE habits SET sort_order = ? WHERE id = ?");
  const entriesRange = database.prepare<[string, string], EntryRow>(
    "SELECT habit_id, date, count FROM habit_entries WHERE date >= ? AND date <= ? ORDER BY date",
  );
  const entriesFor = database.prepare<[string], EntryRow>("SELECT habit_id, date, count FROM habit_entries WHERE habit_id = ?");
  const firstEntries = database.prepare<[], { habit_id: string; first: string }>("SELECT habit_id, MIN(date) AS first FROM habit_entries GROUP BY habit_id");
  const upsertEntry = database.prepare<[string, string, number]>(
    "INSERT INTO habit_entries (habit_id, date, count) VALUES (?, ?, ?) ON CONFLICT(habit_id, date) DO UPDATE SET count = excluded.count",
  );
  const deleteEntry = database.prepare<[string, string]>("DELETE FROM habit_entries WHERE habit_id = ? AND date = ?");

  function toHabit(row: HabitRow): Habit {
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color as Habit["color"],
      kind: row.kind as Habit["kind"],
      targetCount: row.target_count,
      unit: row.unit,
      cadence: row.cadence as Habit["cadence"],
      weekdays: maskToWeekdays(row.weekdays),
      remindAt: row.remind_at,
      sortOrder: row.sort_order,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
    };
  }

  function get(id: string): Habit | null {
    const row = selectOne.get(id);
    return row ? toHabit(row) : null;
  }

  function require(id: string): Habit {
    const habit = get(id);
    if (!habit) throw new Error("Habit not found.");
    return habit;
  }

  function list(): Habit[] {
    return selectAll.all().map(toHabit);
  }

  function countsFor(habitId: string): Map<IsoDate, number> {
    const counts = new Map<IsoDate, number>();
    for (const row of entriesFor.all(habitId)) counts.set(row.date, row.count);
    return counts;
  }

  return {
    list,
    get,
    create(input) {
      const id = newId();
      const sortOrder = (maxSort.get()?.max ?? -1) + 1;
      insert.run(id, input.name, input.icon, input.color, input.kind, input.targetCount, input.unit, input.cadence, weekdaysToMask(input.weekdays), input.remindAt, sortOrder, nowIso());
      return require(id);
    },
    update(id, input) {
      require(id);
      updateRow.run(input.name, input.icon, input.color, input.kind, input.targetCount, input.unit, input.cadence, weekdaysToMask(input.weekdays), input.remindAt, id);
      return require(id);
    },
    setArchived(id, archived) {
      archive.run(archived ? nowIso() : null, id);
      return require(id);
    },
    remove(id) {
      deleteRow.run(id);
    },
    reorder: database.transaction((ids: readonly string[]) => {
      ids.forEach((id, index) => setSort.run(index, id));
    }),
    entries(from, to) {
      return entriesRange.all(from, to).map((row) => ({ habitId: row.habit_id, date: row.date, count: row.count }));
    },
    countsFor,
    firstEntryDates: () => new Map(firstEntries.all().map((row) => [row.habit_id, row.first])),
    setEntry(entry) {
      if (entry.count <= 0) deleteEntry.run(entry.habitId, entry.date);
      else upsertEntry.run(entry.habitId, entry.date, entry.count);
      return { ...entry, count: Math.max(0, entry.count) };
    },
    stats(habit, today) {
      const counts = countsFor(habit.id);
      const result = computeStreaks({
        cadence: habit.cadence,
        weekdayMask: weekdaysToMask(habit.weekdays),
        targetCount: habit.targetCount,
        counts,
        createdOn: trackingStart(habit.createdAt, counts, today),
        today,
      });
      return {
        habitId: habit.id,
        currentStreak: result.current,
        bestStreak: result.best,
        completedLast30: result.completedLast30,
        scheduledLast30: result.scheduledLast30,
        totalCompleted: result.totalCompleted,
      };
    },
    withReminders() {
      return list().filter((habit) => habit.archivedAt === null && habit.remindAt !== null);
    },
  };
}

export function createMedalsRepository(database: SoulDatabase): MedalsRepository {
  const selectSql = `
    SELECT m.id, m.kind, m.subject_kind, m.subject_id, m.earned_at,
      CASE m.subject_kind
        WHEN 'habit' THEN (SELECT name FROM habits WHERE id = m.subject_id)
        WHEN 'routine' THEN (SELECT name FROM routines WHERE id = m.subject_id)
        WHEN 'global' THEN (SELECT name FROM savings_goals WHERE id = m.subject_id)
        ELSE NULL
      END AS subject_name
    FROM medals m`;
  const selectAll = database.prepare<[], MedalRow>(`${selectSql} ORDER BY m.earned_at DESC`);
  const selectRecent = database.prepare<[number], MedalRow>(`${selectSql} ORDER BY m.earned_at DESC LIMIT ?`);
  const selectOne = database.prepare<[string], MedalRow>(`${selectSql} WHERE m.id = ?`);
  const exists = database.prepare<[string, string, string], { id: string }>(
    "SELECT id FROM medals WHERE kind = ? AND subject_kind = ? AND subject_id = ?",
  );
  const insert = database.prepare<[string, string, string, string, string]>(
    "INSERT INTO medals (id, kind, subject_kind, subject_id, earned_at) VALUES (?, ?, ?, ?, ?)",
  );

  function toMedal(row: MedalRow): Medal {
    return {
      id: row.id,
      kind: row.kind as MedalKind,
      subjectKind: row.subject_kind as Medal["subjectKind"],
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      earnedAt: row.earned_at,
    };
  }

  return {
    list: () => selectAll.all().map(toMedal),
    recent: (limit) => selectRecent.all(limit).map(toMedal),
    award(kind, subjectKind, subjectId) {
      if (exists.get(kind, subjectKind, subjectId)) return null;
      const id = newId();
      insert.run(id, kind, subjectKind, subjectId, nowIso());
      const row = selectOne.get(id);
      return row ? toMedal(row) : null;
    },
  };
}
