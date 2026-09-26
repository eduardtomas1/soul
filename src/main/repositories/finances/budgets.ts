import type { SoulDatabase } from "../../database/open";
import type { Budget } from "@shared/contracts/finances";

export interface BudgetsStore {
  readonly list: () => Budget[];
  readonly set: (categoryId: string, monthlyLimitCents: number | null) => Budget[];
}

export function createBudgetsStore(database: SoulDatabase): BudgetsStore {
  const selectBudgets = database.prepare<[], { category_id: string; monthly_limit_cents: number }>("SELECT * FROM budgets");
  const upsertBudget = database.prepare<[string, number]>(
    "INSERT INTO budgets (category_id, monthly_limit_cents) VALUES (?, ?) ON CONFLICT(category_id) DO UPDATE SET monthly_limit_cents = excluded.monthly_limit_cents",
  );
  const deleteBudget = database.prepare<[string]>("DELETE FROM budgets WHERE category_id = ?");

  const list = (): Budget[] => selectBudgets.all().map((row) => ({ categoryId: row.category_id, monthlyLimitCents: row.monthly_limit_cents }));

  return {
    list,
    set(categoryId: string, monthlyLimitCents: number | null): Budget[] {
      if (monthlyLimitCents === null || monthlyLimitCents <= 0) deleteBudget.run(categoryId);
      else upsertBudget.run(categoryId, monthlyLimitCents);
      return list();
    },
  };
}
