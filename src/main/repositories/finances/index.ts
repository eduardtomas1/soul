import type { SoulDatabase } from "../../database/open";
import { createAccountsStore, type AccountsStore } from "./accounts";
import { createBudgetsStore, type BudgetsStore } from "./budgets";
import { createCategoriesStore, type CategoriesStore } from "./categories";
import { createGoalsStore, type GoalsStore } from "./goals";
import { createRecurringStore, type RecurringStore } from "./recurring";
import { createSummaryQueries, type SummaryQueries } from "./summary";
import { createTransactionsStore, type TransactionsStore } from "./transactions";

export interface FinancesRepository extends SummaryQueries {
  readonly accounts: AccountsStore;
  readonly categories: CategoriesStore;
  readonly transactions: TransactionsStore;
  readonly recurring: RecurringStore;
  readonly budgets: BudgetsStore;
  readonly goals: GoalsStore;
}

export function createFinancesRepository(database: SoulDatabase): FinancesRepository {
  const transactions = createTransactionsStore(database);
  const budgets = createBudgetsStore(database);
  return {
    accounts: createAccountsStore(database),
    categories: createCategoriesStore(database),
    transactions,
    recurring: createRecurringStore(database, transactions.create),
    budgets,
    goals: createGoalsStore(database),
    ...createSummaryQueries(database, budgets.list),
  };
}
