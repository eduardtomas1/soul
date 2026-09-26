import type { SoulDatabase } from "../database/open";
import { newId, nowIso } from "../database/ids";
import type { IsoDate } from "@shared/contracts/common";
import type { Routine, RoutineDay, RoutineHistoryDay, RoutineInput, RoutineStep } from "@shared/contracts/routines";
import { eachDay, isScheduledOn, maskToWeekdays, weekdaysToMask } from "@shared/dates";

interface RoutineRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  time_of_day: string | null;
  weekdays: number;
  remind_at: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

interface StepRow {
  id: string;
  routine_id: string;
  name: string;
  duration_minutes: number | null;
  sort_order: number;
}

export interface RoutinesRepository {
  readonly list: () => Routine[];
  readonly get: (id: string) => Routine | null;
  readonly create: (input: RoutineInput) => Routine;
  readonly update: (id: string, input: RoutineInput) => Routine;
  readonly setArchived: (id: string, archived: boolean) => Routine;
  readonly remove: (id: string) => void;
  readonly reorder: (ids: readonly string[]) => void;
  readonly dayStates: (date: IsoDate) => RoutineDay[];
  readonly setStep: (routineId: string, stepId: string, date: IsoDate, completed: boolean) => RoutineDay;
  readonly history: (routineId: string, from: IsoDate, to: IsoDate) => RoutineHistoryDay[];
  readonly completedDates: (routineId: string, from: IsoDate, to: IsoDate) => Set<IsoDate>;
  readonly completionCounts: (from: IsoDate, to: IsoDate) => Array<{ routineId: string; date: IsoDate; completedSteps: number }>;
  readonly firstCompletionDates: () => Map<string, IsoDate>;
  readonly withReminders: () => Routine[];
}

export function createRoutinesRepository(database: SoulDatabase): RoutinesRepository {
  const selectAll = database.prepare<[], RoutineRow>("SELECT * FROM routines ORDER BY sort_order, created_at");
  const selectOne = database.prepare<[string], RoutineRow>("SELECT * FROM routines WHERE id = ?");
  const selectSteps = database.prepare<[], StepRow>("SELECT * FROM routine_steps ORDER BY routine_id, sort_order");
  const selectStepsFor = database.prepare<[string], StepRow>("SELECT * FROM routine_steps WHERE routine_id = ? ORDER BY sort_order");
  const insert = database.prepare<[string, string, string, string, string | null, number, string | null, number, string]>(
    "INSERT INTO routines (id, name, icon, color, time_of_day, weekdays, remind_at, sort_order, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)",
  );
  const updateRow = database.prepare<[string, string, string, string | null, number, string | null, string]>(
    "UPDATE routines SET name = ?, icon = ?, color = ?, time_of_day = ?, weekdays = ?, remind_at = ? WHERE id = ?",
  );
  const archive = database.prepare<[string | null, string]>("UPDATE routines SET archived_at = ? WHERE id = ?");
  const deleteRow = database.prepare<[string]>("DELETE FROM routines WHERE id = ?");
  const maxSort = database.prepare<[], { max: number | null }>("SELECT MAX(sort_order) AS max FROM routines");
  const setSort = database.prepare<[number, string]>("UPDATE routines SET sort_order = ? WHERE id = ?");
  const insertStep = database.prepare<[string, string, string, number | null, number]>(
    "INSERT INTO routine_steps (id, routine_id, name, duration_minutes, sort_order) VALUES (?, ?, ?, ?, ?)",
  );
  const updateStep = database.prepare<[string, number | null, number, string, string]>(
    "UPDATE routine_steps SET name = ?, duration_minutes = ?, sort_order = ? WHERE id = ? AND routine_id = ?",
  );
  const deleteStep = database.prepare<[string, string]>("DELETE FROM routine_steps WHERE id = ? AND routine_id = ?");
  const stepOfRoutine = database.prepare<[string, string], { id: string }>("SELECT id FROM routine_steps WHERE id = ? AND routine_id = ?");
  const completionsOn = database.prepare<[string], { routine_id: string; step_id: string }>(
    "SELECT routine_id, step_id FROM routine_step_completions WHERE date = ?",
  );
  const completionsFor = database.prepare<[string, string], { step_id: string }>(
    "SELECT step_id FROM routine_step_completions WHERE routine_id = ? AND date = ?",
  );
  const completionsRange = database.prepare<[string, string, string], { date: string; step_id: string }>(
    "SELECT date, step_id FROM routine_step_completions WHERE routine_id = ? AND date >= ? AND date <= ?",
  );
  const completionTotals = database.prepare<[string, string], { routine_id: string; date: string; completed: number }>(
    "SELECT routine_id, date, COUNT(*) AS completed FROM routine_step_completions WHERE date >= ? AND date <= ? GROUP BY routine_id, date",
  );
  const firstCompletions = database.prepare<[], { routine_id: string; first: string }>(
    "SELECT routine_id, MIN(date) AS first FROM routine_step_completions GROUP BY routine_id",
  );
  const insertCompletion = database.prepare<[string, string, string, string]>(
    "INSERT OR IGNORE INTO routine_step_completions (routine_id, step_id, date, completed_at) VALUES (?, ?, ?, ?)",
  );
  const deleteCompletion = database.prepare<[string, string]>(
    "DELETE FROM routine_step_completions WHERE step_id = ? AND date = ?",
  );

  function toStep(row: StepRow): RoutineStep {
    return {
      id: row.id,
      routineId: row.routine_id,
      name: row.name,
      durationMinutes: row.duration_minutes,
      sortOrder: row.sort_order,
    };
  }

  function toRoutine(row: RoutineRow, steps: RoutineStep[]): Routine {
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color as Routine["color"],
      timeOfDay: row.time_of_day,
      weekdays: maskToWeekdays(row.weekdays),
      remindAt: row.remind_at,
      sortOrder: row.sort_order,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      steps,
    };
  }

  function list(): Routine[] {
    const stepsByRoutine = new Map<string, RoutineStep[]>();
    for (const row of selectSteps.all()) {
      const bucket = stepsByRoutine.get(row.routine_id) ?? [];
      bucket.push(toStep(row));
      stepsByRoutine.set(row.routine_id, bucket);
    }
    return selectAll.all().map((row) => toRoutine(row, stepsByRoutine.get(row.id) ?? []));
  }

  function get(id: string): Routine | null {
    const row = selectOne.get(id);
    if (!row) return null;
    return toRoutine(row, selectStepsFor.all(id).map(toStep));
  }

  function require(id: string): Routine {
    const routine = get(id);
    if (!routine) throw new Error("Routine not found.");
    return routine;
  }

  const syncSteps = database.transaction((routineId: string, input: RoutineInput) => {
    const existing = new Set(selectStepsFor.all(routineId).map((row) => row.id));
    const keep = new Set<string>();
    input.steps.forEach((step, index) => {
      if (step.id && existing.has(step.id)) {
        updateStep.run(step.name, step.durationMinutes, index, step.id, routineId);
        keep.add(step.id);
      } else {
        const id = newId();
        insertStep.run(id, routineId, step.name, step.durationMinutes, index);
        keep.add(id);
      }
    });
    for (const id of existing) if (!keep.has(id)) deleteStep.run(id, routineId);
  });

  const create = database.transaction((input: RoutineInput): Routine => {
    const id = newId();
    const sortOrder = (maxSort.get()?.max ?? -1) + 1;
    insert.run(id, input.name, input.icon, input.color, input.timeOfDay, weekdaysToMask(input.weekdays), input.remindAt, sortOrder, nowIso());
    syncSteps(id, input);
    return require(id);
  });

  const update = database.transaction((id: string, input: RoutineInput): Routine => {
    require(id);
    updateRow.run(input.name, input.icon, input.color, input.timeOfDay, weekdaysToMask(input.weekdays), input.remindAt, id);
    syncSteps(id, input);
    return require(id);
  });

  const reorder = database.transaction((ids: readonly string[]) => {
    ids.forEach((id, index) => setSort.run(index, id));
  });

  function dayStates(date: IsoDate): RoutineDay[] {
    const completed = new Map<string, string[]>();
    for (const row of completionsOn.all(date)) {
      const bucket = completed.get(row.routine_id) ?? [];
      bucket.push(row.step_id);
      completed.set(row.routine_id, bucket);
    }
    return selectAll.all().map((row) => ({
      routineId: row.id,
      date,
      completedStepIds: completed.get(row.id) ?? [],
    }));
  }

  function dayState(routineId: string, date: IsoDate): RoutineDay {
    return { routineId, date, completedStepIds: completionsFor.all(routineId, date).map((row) => row.step_id) };
  }

  function history(routineId: string, from: IsoDate, to: IsoDate): RoutineHistoryDay[] {
    const routine = require(routineId);
    const mask = weekdaysToMask(routine.weekdays);
    const perDay = new Map<string, number>();
    for (const row of completionsRange.all(routineId, from, to)) {
      perDay.set(row.date, (perDay.get(row.date) ?? 0) + 1);
    }
    return eachDay(from, to).map((date) => ({
      date,
      scheduled: isScheduledOn(mask, date),
      completedSteps: perDay.get(date) ?? 0,
      totalSteps: routine.steps.length,
    }));
  }

  return {
    list,
    get,
    create,
    update,
    setArchived(id, archived) {
      archive.run(archived ? nowIso() : null, id);
      return require(id);
    },
    remove(id) {
      deleteRow.run(id);
    },
    reorder,
    dayStates,
    setStep(routineId, stepId, date, completed) {
      if (!stepOfRoutine.get(stepId, routineId)) throw new Error("That step is not part of this routine.");
      if (completed) insertCompletion.run(routineId, stepId, date, nowIso());
      else deleteCompletion.run(stepId, date);
      return dayState(routineId, date);
    },
    history,
    completedDates(routineId, from, to) {
      const routine = require(routineId);
      const total = routine.steps.length;
      const perDay = new Map<string, number>();
      for (const row of completionsRange.all(routineId, from, to)) perDay.set(row.date, (perDay.get(row.date) ?? 0) + 1);
      const dates = new Set<IsoDate>();
      if (total === 0) return dates;
      for (const [date, count] of perDay) if (count >= total) dates.add(date);
      return dates;
    },
    completionCounts: (from, to) => completionTotals.all(from, to).map((row) => ({ routineId: row.routine_id, date: row.date, completedSteps: row.completed })),
    firstCompletionDates: () => new Map(firstCompletions.all().map((row) => [row.routine_id, row.first])),
    withReminders() {
      return list().filter((routine) => routine.archivedAt === null && routine.remindAt !== null);
    },
  };
}
