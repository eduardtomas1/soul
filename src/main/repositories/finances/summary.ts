import type { SoulDatabase } from "../../database/open";
import type { IsoDate, IsoMonth } from "@shared/contracts/common";
import type { Budget, MonthSummary, MonthTrend } from "@shared/contracts/finances";
import { addMonthsToMonth, firstDayOfMonth, lastDayOfMonth, localDateOf } from "@shared/dates";

const BALANCE = "a.opening_balance_cents + COALESCE((SELECT SUM(t.amount_cents) FROM transactions t WHERE t.account_id = a.id), 0)";
const TOTALS = `SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END) AS income,
       SUM(CASE WHEN amount_cents < 0 THEN -amount_cents ELSE 0 END) AS expense`;

export interface DailyTotal {
  readonly date: IsoDate;
  readonly incomeCents: number;
  readonly expenseCents: number;
  readonly count: number;
}

export interface RangeTotals {
  readonly incomeCents: number;
  readonly expenseCents: number;
}

export interface SummaryQueries {
  readonly monthSummary: (month: IsoMonth) => MonthSummary;
  readonly monthTrends: (lastMonth: IsoMonth, count: number, today: IsoDate) => MonthTrend[];
  readonly dailyTotals: (from: IsoDate, to: IsoDate) => DailyTotal[];
  readonly totalsBetween: (from: IsoDate, to: IsoDate) => RangeTotals;
  readonly netWorthCents: () => number;
  readonly netWorthAt: (date: IsoDate) => number;
  readonly liquidCents: () => number;
  readonly averageDiscretionaryExpenseCents: (today: IsoDate, months: number) => number;
}

export function createSummaryQueries(database: SoulDatabase, budgets: () => Budget[]): SummaryQueries {
  const rangeTotals = database.prepare<[string, string], { income: number | null; expense: number | null }>(
    `SELECT ${TOTALS} FROM transactions WHERE occurred_on >= ? AND occurred_on <= ? AND transfer_group_id IS NULL`,
  );
  const totalsByMonth = database.prepare<[string, string], { month: string; income: number | null; expense: number | null }>(
    `SELECT substr(occurred_on, 1, 7) AS month, ${TOTALS} FROM transactions
     WHERE occurred_on >= ? AND occurred_on <= ? AND transfer_group_id IS NULL GROUP BY month`,
  );
  const totalsByDay = database.prepare<[string, string], { date: string; income: number | null; expense: number | null; count: number }>(
    `SELECT occurred_on AS date, ${TOTALS}, COUNT(*) AS count FROM transactions
     WHERE occurred_on >= ? AND occurred_on <= ? AND transfer_group_id IS NULL GROUP BY occurred_on ORDER BY occurred_on`,
  );
  const monthByCategory = database.prepare<[string, string], { category_id: string | null; spent: number }>(
    `SELECT category_id, SUM(-amount_cents) AS spent FROM transactions
     WHERE occurred_on >= ? AND occurred_on <= ? AND amount_cents < 0 AND transfer_group_id IS NULL
     GROUP BY category_id ORDER BY spent DESC`,
  );
  const netWorth = database.prepare<[], { total: number | null }>(`SELECT SUM(${BALANCE}) AS total FROM accounts a WHERE a.archived_at IS NULL`);
  const balancesOn = database.prepare<[string], { archived_at: string | null; balance: number }>(
    `SELECT a.archived_at, a.opening_balance_cents + COALESCE((SELECT SUM(t.amount_cents) FROM transactions t WHERE t.account_id = a.id AND t.occurred_on <= ?), 0) AS balance
     FROM accounts a`,
  );
  const liquid = database.prepare<[], { total: number | null }>(
    `SELECT SUM(${BALANCE}) AS total FROM accounts a WHERE a.archived_at IS NULL AND a.kind IN ('checking', 'savings', 'cash', 'card')`,
  );
  const discretionary = database.prepare<[string, string], { total: number | null }>(
    `SELECT SUM(-amount_cents) AS total FROM transactions
     WHERE occurred_on >= ? AND occurred_on <= ? AND amount_cents < 0 AND recurring_rule_id IS NULL AND transfer_group_id IS NULL`,
  );

  const netWorthAt = (date: IsoDate): number =>
    balancesOn.all(date).reduce((sum, row) => (row.archived_at === null || localDateOf(row.archived_at) > date ? sum + row.balance : sum), 0);
  const netWorthCents = (): number => netWorth.get()?.total ?? 0;

  return {
    monthSummary(month: IsoMonth): MonthSummary {
      const from = firstDayOfMonth(month);
      const to = lastDayOfMonth(month);
      const totals = rangeTotals.get(from, to);
      const limits = new Map(budgets().map((budget) => [budget.categoryId, budget.monthlyLimitCents]));
      const byCategory = monthByCategory.all(from, to).map((row) => ({
        categoryId: row.category_id,
        spentCents: row.spent,
        limitCents: row.category_id ? (limits.get(row.category_id) ?? null) : null,
      }));
      for (const [categoryId, limitCents] of limits) {
        if (!byCategory.some((entry) => entry.categoryId === categoryId)) byCategory.push({ categoryId, spentCents: 0, limitCents });
      }
      const incomeCents = totals?.income ?? 0;
      const expenseCents = totals?.expense ?? 0;
      return { month, incomeCents, expenseCents, netCents: incomeCents - expenseCents, byCategory };
    },
    monthTrends(lastMonth: IsoMonth, count: number, today: IsoDate): MonthTrend[] {
      const firstMonth = addMonthsToMonth(lastMonth, -(count - 1));
      const totals = new Map(totalsByMonth.all(firstDayOfMonth(firstMonth), lastDayOfMonth(lastMonth)).map((row) => [row.month, row]));
      return Array.from({ length: count }, (_, index) => {
        const month = addMonthsToMonth(firstMonth, index);
        const end = lastDayOfMonth(month);
        const row = totals.get(month);
        const incomeCents = row?.income ?? 0;
        const expenseCents = row?.expense ?? 0;
        return { month, incomeCents, expenseCents, netCents: incomeCents - expenseCents, netWorthCents: end < today ? netWorthAt(end) : netWorthCents() };
      });
    },
    dailyTotals: (from: IsoDate, to: IsoDate): DailyTotal[] =>
      totalsByDay.all(from, to).map((row) => ({ date: row.date, incomeCents: row.income ?? 0, expenseCents: row.expense ?? 0, count: row.count })),
    totalsBetween(from: IsoDate, to: IsoDate): RangeTotals {
      const totals = rangeTotals.get(from, to);
      return { incomeCents: totals?.income ?? 0, expenseCents: totals?.expense ?? 0 };
    },
    netWorthCents,
    netWorthAt,
    liquidCents: (): number => liquid.get()?.total ?? 0,
    averageDiscretionaryExpenseCents(today: IsoDate, months: number): number {
      const currentMonth = today.slice(0, 7);
      const from = firstDayOfMonth(addMonthsToMonth(currentMonth, -months));
      const to = lastDayOfMonth(addMonthsToMonth(currentMonth, -1));
      const total = discretionary.get(from, to)?.total ?? 0;
      return Math.round(total / months);
    },
  };
}
