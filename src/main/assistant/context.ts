import type { IsoDate } from "@shared/contracts/common";
import { addDays, addMonthsToMonth, firstDayOfMonth, lastDayOfMonth, monthOf, todayIso } from "@shared/dates";
import { formatMeasure } from "@shared/measures";
import { formatCents } from "@shared/money";
import { projectCashFlow } from "@shared/projection";
import type { FinancesRepository } from "../repositories/finances";
import type { HabitsRepository } from "../repositories/habits";
import type { JournalRepository } from "../repositories/journal";
import type { MeasuresRepository } from "../repositories/measures";
import type { RoutinesRepository } from "../repositories/routines";

const NOTE_EXCERPT = 600;

export interface AssistantData {
  readonly finances: FinancesRepository;
  readonly habits: HabitsRepository;
  readonly routines: RoutinesRepository;
  readonly journal: JournalRepository;
  readonly measures: MeasuresRepository;
}

export const ASSISTANT_INSTRUCTIONS = `You are the assistant inside Soul, a personal desktop app that tracks routines, habits, a daily journal, personal measures (such as weight or sleep) and money for one person.
Journal mood and energy are rated from 1 (low) to 5 (high).
Money is always in euros and stored as integer cents; present it as euros with two decimals.
Answer from the person's own data. Never invent numbers. If something is not in the data, say so.
Be concise, warm and practical. Prefer short paragraphs and small tables over long lists.
Dates use ISO format (YYYY-MM-DD). Weeks start on Monday.`;

export function financeSummary(data: AssistantData, month: string): unknown {
  const summary = data.finances.monthSummary(month);
  const categories = new Map(data.finances.categories.list().map((category) => [category.id, category.name]));
  return {
    month,
    income: formatCents(summary.incomeCents),
    expenses: formatCents(summary.expenseCents),
    net: formatCents(summary.netCents),
    byCategory: summary.byCategory.map((entry) => ({
      category: entry.categoryId ? (categories.get(entry.categoryId) ?? "Unknown") : "Uncategorised",
      spent: formatCents(entry.spentCents),
      budget: entry.limitCents === null ? null : formatCents(entry.limitCents),
    })),
    accounts: data.finances.accounts.list().filter((account) => account.archivedAt === null).map((account) => ({
      name: account.name,
      kind: account.kind,
      balance: formatCents(account.balanceCents),
    })),
    netWorth: formatCents(data.finances.netWorthCents()),
  };
}

export function transactionsBetween(data: AssistantData, from: IsoDate, to: IsoDate, options: { categoryId?: string; accountId?: string; search?: string; limit?: number } = {}): unknown {
  const categories = new Map(data.finances.categories.list().map((category) => [category.id, category.name]));
  const accounts = new Map(data.finances.accounts.list().map((account) => [account.id, account.name]));
  return data.finances.transactions.list({
    from,
    to,
    limit: options.limit ?? 200,
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.accountId ? { accountId: options.accountId } : {}),
    ...(options.search ? { search: options.search } : {}),
  }).map((transaction) => ({
    date: transaction.occurredOn,
    amount: formatCents(transaction.amountCents),
    account: accounts.get(transaction.accountId) ?? "Unknown",
    category: transaction.categoryId ? (categories.get(transaction.categoryId) ?? "Unknown") : (transaction.transferGroupId ? "Transfer" : "Uncategorised"),
    note: transaction.note,
  }));
}

export function recurringAndProjection(data: AssistantData, months: number): unknown {
  const today = todayIso();
  const rules = data.finances.recurring.list();
  const projection = projectCashFlow({
    startingCents: data.finances.liquidCents(),
    from: today,
    months,
    rules,
    averageDiscretionaryExpenseCents: data.finances.averageDiscretionaryExpenseCents(today, 3),
  });
  return {
    recurring: rules.map((rule) => ({ name: rule.name, amount: formatCents(rule.amountCents), every: `${rule.interval} ${rule.frequency}`, nextDueOn: rule.nextDueOn })),
    averageOtherSpendingPerMonth: formatCents(data.finances.averageDiscretionaryExpenseCents(today, 3)),
    projection: projection.months.map((entry) => ({ month: entry.month, opening: formatCents(entry.openingCents), income: formatCents(entry.incomeCents), expenses: formatCents(entry.expenseCents), closing: formatCents(entry.closingCents) })),
    savingsGoals: data.finances.goals.list().map((goal) => ({ name: goal.name, saved: formatCents(goal.savedCents), target: formatCents(goal.targetCents), targetDate: goal.targetDate, achieved: goal.achievedAt !== null })),
  };
}

export function habitsOverview(data: AssistantData): unknown {
  const today = todayIso();
  return data.habits.list().filter((habit) => habit.archivedAt === null).map((habit) => {
    const stats = data.habits.stats(habit, today);
    return {
      name: habit.name,
      kind: habit.kind,
      target: habit.kind === "count" ? `${habit.targetCount}${habit.unit ? ` ${habit.unit}` : ""} per ${habit.cadence === "daily" ? "day" : "week"}` : habit.cadence,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      completedLast30Days: `${stats.completedLast30}/${stats.scheduledLast30}`,
      totalCompleted: stats.totalCompleted,
    };
  });
}

export function routinesOverview(data: AssistantData, date: IsoDate): unknown {
  const days = new Map(data.routines.dayStates(date).map((day) => [day.routineId, day]));
  return data.routines.list().filter((routine) => routine.archivedAt === null).map((routine) => {
    const history = data.routines.history(routine.id, addDays(date, -13), date);
    const scheduled = history.filter((day) => day.scheduled);
    const completed = scheduled.filter((day) => day.totalSteps > 0 && day.completedSteps >= day.totalSteps).length;
    return {
      name: routine.name,
      timeOfDay: routine.timeOfDay,
      steps: routine.steps.map((step) => step.name),
      completedStepsToday: days.get(routine.id)?.completedStepIds.length ?? 0,
      fullyCompletedLast14Days: `${completed}/${scheduled.length}`,
    };
  });
}

export function journalAndMeasures(data: AssistantData, from: IsoDate, to: IsoDate, includeNotes: boolean): unknown {
  const entries = data.measures.entries(from, to);
  return {
    journal: data.journal.list(from, to).map((entry) => ({
      date: entry.date,
      mood: entry.mood,
      energy: entry.energy,
      ...(includeNotes && entry.note.length > 0 ? { note: entry.note.length > NOTE_EXCERPT ? `${entry.note.slice(0, NOTE_EXCERPT)}…` : entry.note } : {}),
    })),
    measures: data.measures.list().filter((measure) => measure.archivedAt === null).map((measure) => ({
      name: measure.name,
      unit: measure.unit,
      target: measure.target,
      better: measure.direction === "up" ? "higher" : measure.direction === "down" ? "lower" : null,
      values: entries.filter((entry) => entry.measureId === measure.id).map((entry) => ({ date: entry.date, value: formatMeasure(entry.value, measure.decimals, measure.unit) })),
    })),
  };
}

export function contextPack(data: AssistantData, detailed: boolean): string {
  const today = todayIso();
  const month = monthOf(today);
  const lines: string[] = [
    `Today is ${today}. The current month is ${month} (${firstDayOfMonth(month)} to ${lastDayOfMonth(month)}).`,
  ];
  if (detailed) {
    lines.push("Here is the person's current data as JSON:");
    lines.push(JSON.stringify({
      thisMonth: financeSummary(data, month),
      lastMonth: financeSummary(data, addMonthsToMonth(month, -1)),
      recurringAndProjection: recurringAndProjection(data, 6),
      habits: habitsOverview(data),
      routines: routinesOverview(data, today),
      journalAndMeasuresLast14Days: journalAndMeasures(data, addDays(today, -13), today, false),
    }));
  } else {
    lines.push(`Net worth ${formatCents(data.finances.netWorthCents())}. Use the Soul tools to read finances, habits, routines, the journal and measures before answering questions about them.`);
  }
  return lines.join("\n");
}
