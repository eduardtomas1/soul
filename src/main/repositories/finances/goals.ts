import type { SoulDatabase } from "../../database/open";
import { newId, nowIso } from "../../database/ids";
import type { SavingsGoal, SavingsGoalInput } from "@shared/contracts/finances";
import { toGoal, type GoalRow } from "./rows";

export interface GoalsStore {
  readonly list: () => SavingsGoal[];
  readonly create: (input: SavingsGoalInput) => SavingsGoal;
  readonly update: (id: string, input: SavingsGoalInput) => SavingsGoal;
  readonly remove: (id: string) => void;
  readonly contribute: (id: string, amountCents: number) => SavingsGoal;
}

export function createGoalsStore(database: SoulDatabase): GoalsStore {
  const selectGoals = database.prepare<[], GoalRow>("SELECT * FROM savings_goals ORDER BY achieved_at IS NOT NULL, sort_order, created_at");
  const selectGoal = database.prepare<[string], GoalRow>("SELECT * FROM savings_goals WHERE id = ?");
  const insertGoal = database.prepare<[string, string, string, string, number, string | null, number, string]>(
    "INSERT INTO savings_goals (id, name, icon, color, target_cents, saved_cents, target_date, sort_order, achieved_at, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL, ?)",
  );
  const updateGoal = database.prepare<[string, string, string, number, string | null, string]>(
    "UPDATE savings_goals SET name = ?, icon = ?, color = ?, target_cents = ?, target_date = ? WHERE id = ?",
  );
  const setGoalSaved = database.prepare<[number, string | null, string]>("UPDATE savings_goals SET saved_cents = ?, achieved_at = ? WHERE id = ?");
  const deleteGoal = database.prepare<[string]>("DELETE FROM savings_goals WHERE id = ?");
  const maxGoalSort = database.prepare<[], { max: number | null }>("SELECT MAX(sort_order) AS max FROM savings_goals");

  function requireGoal(id: string): SavingsGoal {
    const row = selectGoal.get(id);
    if (!row) throw new Error("Savings goal not found.");
    return toGoal(row);
  }

  return {
    list: () => selectGoals.all().map(toGoal),
    create(input: SavingsGoalInput): SavingsGoal {
      const id = newId();
      insertGoal.run(id, input.name, input.icon, input.color, input.targetCents, input.targetDate, (maxGoalSort.get()?.max ?? -1) + 1, nowIso());
      return requireGoal(id);
    },
    update(id: string, input: SavingsGoalInput): SavingsGoal {
      const existing = requireGoal(id);
      updateGoal.run(input.name, input.icon, input.color, input.targetCents, input.targetDate, id);
      const achieved = existing.savedCents >= input.targetCents ? (existing.achievedAt ?? nowIso()) : null;
      setGoalSaved.run(existing.savedCents, achieved, id);
      return requireGoal(id);
    },
    remove(id: string): void {
      deleteGoal.run(id);
    },
    contribute(id: string, amountCents: number): SavingsGoal {
      const goal = requireGoal(id);
      const saved = Math.max(0, goal.savedCents + amountCents);
      const achieved = saved >= goal.targetCents ? (goal.achievedAt ?? nowIso()) : null;
      setGoalSaved.run(saved, achieved, id);
      return requireGoal(id);
    },
  };
}
