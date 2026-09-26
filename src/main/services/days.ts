import type { IsoDate } from "@shared/contracts/common";
import type { ActivityItem, DayLog, DaySummary } from "@shared/contracts/journal";
import { eachDay, isScheduledOn, localDateOf, weekdaysToMask } from "@shared/dates";
import { MEDAL_LABELS } from "@shared/icons";
import { formatMeasure } from "@shared/measures";
import { formatCents } from "@shared/money";
import type { FinancesRepository } from "../repositories/finances";
import type { HabitsRepository, MedalsRepository } from "../repositories/habits";
import type { JournalRepository } from "../repositories/journal";
import type { MeasuresRepository } from "../repositories/measures";
import type { RoutinesRepository } from "../repositories/routines";

export interface LogSources {
  readonly routines: RoutinesRepository;
  readonly habits: HabitsRepository;
  readonly medals: MedalsRepository;
  readonly finances: FinancesRepository;
  readonly journal: JournalRepository;
  readonly measures: MeasuresRepository;
}

interface Tracked {
  readonly id: string;
  readonly weekdays: readonly number[];
  readonly createdAt: string;
  readonly archivedAt: string | null;
}

function nested<T>(rows: readonly T[], date: (row: T) => IsoDate, id: (row: T) => string, value: (row: T) => number): Map<IsoDate, Map<string, number>> {
  const map = new Map<IsoDate, Map<string, number>>();
  for (const row of rows) {
    const bucket = map.get(date(row)) ?? new Map<string, number>();
    bucket.set(id(row), value(row));
    map.set(date(row), bucket);
  }
  return map;
}

function dueOn(item: Tracked, firstActivity: ReadonlyMap<string, IsoDate>, date: IsoDate): boolean {
  if (item.archivedAt !== null && localDateOf(item.archivedAt) <= date) return false;
  const created = localDateOf(item.createdAt);
  const first = firstActivity.get(item.id);
  const start = first !== undefined && first < created ? first : created;
  return start <= date && isScheduledOn(weekdaysToMask(item.weekdays), date);
}

export function summarizeDays(sources: LogSources, from: IsoDate, to: IsoDate): DaySummary[] {
  const routines = sources.routines.list().filter((routine) => routine.steps.length > 0);
  const habits = sources.habits.list().filter((habit) => habit.cadence === "daily");
  const firstCompletions = sources.routines.firstCompletionDates();
  const firstEntries = sources.habits.firstEntryDates();
  const completions = nested(sources.routines.completionCounts(from, to), (row) => row.date, (row) => row.routineId, (row) => row.completedSteps);
  const entries = nested(sources.habits.entries(from, to), (row) => row.date, (row) => row.habitId, (row) => row.count);
  const money = new Map(sources.finances.dailyTotals(from, to).map((row) => [row.date, row]));
  const journal = new Map(sources.journal.list(from, to).map((entry) => [entry.date, entry]));
  const measured = new Map<IsoDate, number>();
  for (const entry of sources.measures.entries(from, to)) measured.set(entry.date, (measured.get(entry.date) ?? 0) + 1);

  return eachDay(from, to).map((date) => {
    const dueRoutines = routines.filter((routine) => dueOn(routine, firstCompletions, date));
    const dueHabits = habits.filter((habit) => dueOn(habit, firstEntries, date));
    const done = completions.get(date);
    const counts = entries.get(date);
    const entry = journal.get(date);
    const totals = money.get(date);
    return {
      date,
      mood: entry?.mood ?? null,
      energy: entry?.energy ?? null,
      hasNote: (entry?.note.length ?? 0) > 0,
      habitsDone: dueHabits.filter((habit) => (counts?.get(habit.id) ?? 0) >= habit.targetCount).length,
      habitsDue: dueHabits.length,
      routinesDone: dueRoutines.filter((routine) => (done?.get(routine.id) ?? 0) >= routine.steps.length).length,
      routinesDue: dueRoutines.length,
      incomeCents: totals?.incomeCents ?? 0,
      expenseCents: totals?.expenseCents ?? 0,
      transactions: totals?.count ?? 0,
      measures: measured.get(date) ?? 0,
    };
  });
}

function item(fields: Omit<ActivityItem, "amountCents" | "done" | "medalKind"> & Partial<Pick<ActivityItem, "amountCents" | "done" | "medalKind">>): ActivityItem {
  return { amountCents: null, done: null, medalKind: null, ...fields };
}

function routineActivity(sources: LogSources, date: IsoDate): ActivityItem[] {
  const counts = new Map(sources.routines.completionCounts(date, date).map((row) => [row.routineId, row.completedSteps]));
  return sources.routines.list().flatMap((routine) => {
    const completed = counts.get(routine.id) ?? 0;
    if (completed === 0) return [];
    const total = routine.steps.length;
    return [item({ kind: "routine", id: routine.id, title: routine.name, detail: `${completed} of ${total} steps`, icon: routine.icon, color: routine.color, done: completed >= total })];
  });
}

function habitActivity(sources: LogSources, date: IsoDate): ActivityItem[] {
  const habits = new Map(sources.habits.list().map((habit) => [habit.id, habit]));
  return sources.habits.entries(date, date).flatMap((entry) => {
    const habit = habits.get(entry.habitId);
    if (!habit) return [];
    const unit = habit.unit ? ` ${habit.unit}` : "";
    const detail = habit.kind === "check"
      ? "Done"
      : habit.cadence === "daily" ? `${entry.count} of ${habit.targetCount}${unit}` : `${entry.count} logged · ${habit.targetCount}${unit} a week`;
    return [item({ kind: "habit", id: habit.id, title: habit.name, detail, icon: habit.icon, color: habit.color, done: habit.cadence === "daily" ? entry.count >= habit.targetCount : null })];
  });
}

function measureActivity(sources: LogSources, date: IsoDate): ActivityItem[] {
  const measures = new Map(sources.measures.list().map((measure) => [measure.id, measure]));
  return sources.measures.entries(date, date).flatMap((entry) => {
    const measure = measures.get(entry.measureId);
    if (!measure) return [];
    return [item({ kind: "measure", id: measure.id, title: measure.name, detail: formatMeasure(entry.value, measure.decimals, measure.unit), icon: measure.icon, color: measure.color })];
  });
}

function moneyActivity(sources: LogSources, date: IsoDate): ActivityItem[] {
  const categories = new Map(sources.finances.categories.list().map((category) => [category.id, category]));
  const accounts = new Map(sources.finances.accounts.list().map((account) => [account.id, account.name]));
  const transactions = sources.finances.transactions.list({ from: date, to: date, limit: 500 });
  const seenTransfers = new Set<string>();
  const items: ActivityItem[] = [];
  for (const transaction of [...transactions].reverse()) {
    const account = accounts.get(transaction.accountId) ?? "Unknown account";
    if (transaction.transferGroupId) {
      if (seenTransfers.has(transaction.transferGroupId)) continue;
      seenTransfers.add(transaction.transferGroupId);
      const other = transactions.find((entry) => entry.transferGroupId === transaction.transferGroupId && entry.id !== transaction.id);
      const [from, to] = transaction.amountCents < 0 ? [account, accounts.get(other?.accountId ?? "")] : [accounts.get(other?.accountId ?? ""), account];
      const route = `${from ?? "Unknown account"} → ${to ?? "Unknown account"}`;
      items.push(item({ kind: "transaction", id: transaction.id, title: "Transfer", detail: [formatCents(Math.abs(transaction.amountCents)), route, transaction.note].filter(Boolean).join(" · "), icon: "bank", color: "slate" }));
      continue;
    }
    const category = transaction.categoryId ? categories.get(transaction.categoryId) : undefined;
    items.push(item({
      kind: "transaction",
      id: transaction.id,
      title: category?.name ?? "Uncategorised",
      detail: [transaction.note, account].filter(Boolean).join(" · "),
      icon: category?.icon ?? "receipt",
      color: category?.color ?? "slate",
      amountCents: transaction.amountCents,
    }));
  }
  return items;
}

function milestoneActivity(sources: LogSources, date: IsoDate): ActivityItem[] {
  return sources.medals.list()
    .filter((medal) => localDateOf(medal.earnedAt) === date)
    .map((medal) => item({ kind: "milestone", id: medal.id, title: MEDAL_LABELS[medal.kind].title, detail: medal.subjectName ?? MEDAL_LABELS[medal.kind].description, icon: "trophy", color: "amber", medalKind: medal.kind }));
}

export function buildDayLog(sources: LogSources, date: IsoDate, summary?: DaySummary): DayLog {
  return {
    date,
    entry: sources.journal.get(date),
    summary: summary ?? summarizeDays(sources, date, date)[0]!,
    activity: [
      ...routineActivity(sources, date),
      ...habitActivity(sources, date),
      ...measureActivity(sources, date),
      ...moneyActivity(sources, date),
      ...milestoneActivity(sources, date),
    ],
  };
}
