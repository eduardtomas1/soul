import { describe, expect, it } from "vitest";
import { openInMemoryDatabase } from "../src/main/database/open";
import { createFinancesRepository } from "../src/main/repositories/finances";
import { createHabitsRepository, createMedalsRepository } from "../src/main/repositories/habits";
import { createJournalRepository } from "../src/main/repositories/journal";
import { createMeasuresRepository } from "../src/main/repositories/measures";
import { createRoutinesRepository } from "../src/main/repositories/routines";
import { buildDayLog, summarizeDays } from "../src/main/services/days";
import { createMedalService } from "../src/main/services/medals";
import { buildToday } from "../src/main/services/today";
import { contextPack, financeSummary, habitsOverview, journalAndMeasures } from "../src/main/assistant/context";
import { soulTools } from "../src/main/assistant/claude";
import { addDays, eachDay } from "../src/shared/dates";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const;

function setup() {
  const database = openInMemoryDatabase();
  const routines = createRoutinesRepository(database);
  const habits = createHabitsRepository(database);
  const medals = createMedalsRepository(database);
  const finances = createFinancesRepository(database);
  const journal = createJournalRepository(database);
  const measures = createMeasuresRepository(database);
  finances.categories.ensureDefaults();
  const service = createMedalService(habits, routines, finances, medals);
  const sources = { routines, habits, medals, finances, journal, measures };
  return { database, routines, habits, medals, finances, journal, measures, service, sources };
}

describe("medals", () => {
  it("awards the first step and a week-long streak once", () => {
    const { database, habits, service } = setup();
    const habit = habits.create({ name: "Read", icon: "books", color: "plum", kind: "check", targetCount: 1, unit: null, cadence: "daily", weekdays: [...EVERY_DAY], remindAt: null });
    const days = eachDay("2026-03-01", "2026-03-07");
    const kinds: string[] = [];
    for (const date of days) {
      habits.setEntry({ habitId: habit.id, date, count: 1 });
      kinds.push(...service.afterHabitEntry(habit, date, "2026-03-07").map((medal) => medal.kind));
    }
    expect(kinds).toEqual(["first-step", "streak-7"]);
    expect(service.afterHabitEntry(habit, "2026-03-07", "2026-03-07")).toEqual([]);
    database.close();
  });

  it("settles a perfect week for weekday habits once the week is over", () => {
    const { database, habits, service } = setup();
    const habit = habits.create({ name: "Stand-up", icon: "books", color: "plum", kind: "check", targetCount: 1, unit: null, cadence: "daily", weekdays: [0, 1, 2, 3, 4], remindAt: null });
    database.prepare("UPDATE habits SET created_at = ?").run("2026-02-01T08:00:00.000Z");
    for (const date of eachDay("2026-03-02", "2026-03-06")) {
      habits.setEntry({ habitId: habit.id, date, count: 1 });
      expect(service.afterHabitEntry(habit, date, date).map((medal) => medal.kind)).not.toContain("perfect-week");
    }
    expect(service.afterPeriodsClosed("2026-03-10").map((medal) => medal.subjectId)).toContain("2026-03-02");
    expect(service.afterPeriodsClosed("2026-03-10")).toEqual([]);
    database.close();
  });

  it("measures weekly habits' streak milestones in weeks", () => {
    const { database, habits, service } = setup();
    const run = habits.create({ name: "Run", icon: "running-shoe", color: "coral", kind: "count", targetCount: 1, unit: null, cadence: "weekly", weekdays: [...EVERY_DAY], remindAt: null });
    habits.setEntry({ habitId: run.id, date: "2026-03-03", count: 1 });
    expect(service.afterHabitEntry(run, "2026-03-03", "2026-03-08").map((medal) => medal.kind)).toEqual(["first-step", "streak-7"]);
    database.close();
  });

  it("awards a perfect week when every habit was done on every scheduled day", () => {
    const { database, habits, service } = setup();
    habits.create({ name: "Read", icon: "books", color: "plum", kind: "check", targetCount: 1, unit: null, cadence: "daily", weekdays: [0, 1, 2, 3, 4], remindAt: null });
    habits.create({ name: "Run", icon: "running-shoe", color: "coral", kind: "count", targetCount: 2, unit: "runs", cadence: "weekly", weekdays: [...EVERY_DAY], remindAt: null });
    database.prepare("UPDATE habits SET created_at = ?").run("2026-02-01T08:00:00.000Z");
    const [read, run] = habits.list() as [ReturnType<typeof habits.list>[number], ReturnType<typeof habits.list>[number]];
    for (const date of eachDay("2026-03-02", "2026-03-06")) habits.setEntry({ habitId: read.id, date, count: 1 });
    habits.setEntry({ habitId: run.id, date: "2026-03-03", count: 1 });
    expect(service.afterHabitEntry(run, "2026-03-03", "2026-03-08").map((medal) => medal.kind)).not.toContain("perfect-week");
    habits.setEntry({ habitId: run.id, date: "2026-03-08", count: 1 });
    const earned = service.afterHabitEntry(run, "2026-03-08", "2026-03-08");
    expect(earned.find((medal) => medal.kind === "perfect-week")?.subjectId).toBe("2026-03-02");
    database.close();
  });

  it("awards a routine week, the saver and the budget keeper", () => {
    const { database, routines, finances, service } = setup();
    const routine = routines.create({ name: "Morning", icon: "sunrise", color: "amber", timeOfDay: null, weekdays: [...EVERY_DAY], remindAt: null, steps: [{ name: "Water", durationMinutes: null }] });
    const step = routine.steps[0]!;
    for (const date of eachDay("2026-03-01", "2026-03-06")) routines.setStep(routine.id, step.id, date, true);
    expect(service.afterRoutineStep(routine, "2026-03-06")).toEqual([]);
    routines.setStep(routine.id, step.id, "2026-03-07", true);
    expect(service.afterRoutineStep(routine, "2026-03-07").map((medal) => medal.kind)).toEqual(["routine-week"]);

    const goal = finances.goals.create({ name: "Bike", icon: "bicycle", color: "amber", targetCents: 5_000, targetDate: null });
    const reached = finances.goals.contribute(goal.id, 5_000);
    expect(service.afterGoalChange(reached.id, reached.achievedAt !== null).map((medal) => medal.kind)).toEqual(["saver"]);

    const account = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 0 });
    const groceries = finances.categories.list().find((category) => category.name === "Groceries")!;
    finances.budgets.set(groceries.id, 20_000);
    finances.transactions.create({ accountId: account.id, categoryId: groceries.id, amountCents: -15_000, occurredOn: "2026-02-10", note: "" });
    expect(service.afterMonthClosed("2026-03-01").map((medal) => medal.subjectId)).toEqual(["2026-02"]);
    finances.transactions.create({ accountId: account.id, categoryId: groceries.id, amountCents: -25_000, occurredOn: "2026-03-10", note: "" });
    expect(service.afterMonthClosed("2026-04-02")).toEqual([]);
    database.close();
  });
});

describe("today", () => {
  it("shows what is scheduled and what is coming", () => {
    const { database, routines, habits, finances, sources } = setup();
    routines.create({ name: "Weekdays", icon: "sunrise", color: "amber", timeOfDay: "07:00", weekdays: [0, 1, 2, 3, 4], remindAt: null, steps: [{ name: "Water", durationMinutes: null }] });
    const archived = routines.create({ name: "Old", icon: "bed", color: "iris", timeOfDay: null, weekdays: [...EVERY_DAY], remindAt: null, steps: [{ name: "Sleep", durationMinutes: null }] });
    routines.setArchived(archived.id, true);
    habits.create({ name: "Run", icon: "running-shoe", color: "coral", kind: "count", targetCount: 3, unit: "runs", cadence: "weekly", weekdays: [...EVERY_DAY], remindAt: null });
    habits.create({ name: "Weekday habit", icon: "books", color: "plum", kind: "check", targetCount: 1, unit: null, cadence: "daily", weekdays: [0], remindAt: null });
    const account = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 50_000 });
    finances.recurring.create({ name: "Rent", accountId: account.id, categoryId: null, amountCents: -90_000, frequency: "monthly", interval: 1, anchorDate: "2026-03-10", endDate: null, autoPost: true });

    const saturday = buildToday("2026-03-07", sources);
    expect(saturday.routines).toEqual([]);
    expect(saturday.habits.map((habit) => habit.name)).toEqual(["Run"]);
    expect(saturday.upcoming.map((item) => item.dueOn)).toEqual(["2026-03-10"]);
    expect(saturday.netWorthCents).toBe(50_000);

    const monday = buildToday("2026-03-09", sources);
    expect(monday.routines.map((routine) => routine.name)).toEqual(["Weekdays"]);
    expect(monday.habits.map((habit) => habit.name)).toEqual(["Run", "Weekday habit"]);
    expect(monday.days).toHaveLength(30);
    expect(monday.days.at(-1)?.date).toBe("2026-03-09");
    expect(monday.log.date).toBe("2026-03-09");
    database.close();
  });

  it("compares this month's spending with the same point last month", () => {
    const { database, finances, sources } = setup();
    const account = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 0 });
    finances.transactions.create({ accountId: account.id, categoryId: null, amountCents: -1_000, occurredOn: "2026-02-10", note: "" });
    finances.transactions.create({ accountId: account.id, categoryId: null, amountCents: -9_000, occurredOn: "2026-02-20", note: "" });
    finances.transactions.create({ accountId: account.id, categoryId: null, amountCents: -3_000, occurredOn: "2026-03-05", note: "" });
    finances.transactions.create({ accountId: account.id, categoryId: null, amountCents: -4_000, occurredOn: "2026-03-18", note: "" });
    const today = buildToday("2026-03-12", sources);
    expect(today.monthExpenseCents).toBe(3_000);
    expect(today.lastMonthToDateExpenseCents).toBe(1_000);
    database.close();
  });
});

describe("week and month windows", () => {
  it("shows the whole week of a past day, so weekly totals are right", () => {
    const { database, habits, sources } = setup();
    const gym = habits.create({ name: "Gym", icon: "flexed-biceps", color: "coral", kind: "count", targetCount: 3, unit: null, cadence: "weekly", weekdays: [...EVERY_DAY], remindAt: null });
    for (const date of ["2026-03-02", "2026-03-05", "2026-03-07"]) habits.setEntry({ habitId: gym.id, date, count: 1 });
    const wednesday = buildToday("2026-03-04", sources);
    expect(wednesday.habitEntries.map((entry) => entry.date).sort()).toEqual(["2026-03-02", "2026-03-05", "2026-03-07"]);
    database.close();
  });

  it("covers the whole month on its 31st day", () => {
    const { database, finances, sources } = setup();
    const account = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 0 });
    finances.transactions.create({ accountId: account.id, categoryId: null, amountCents: -95_000, occurredOn: "2026-10-01", note: "Rent" });
    const today = buildToday("2026-10-31", sources);
    expect(today.days[0]?.date).toBe("2026-10-01");
    expect(today.days.reduce((sum, day) => sum + day.expenseCents, 0)).toBe(today.monthExpenseCents);
    database.close();
  });
});

describe("daily log", () => {
  function seed() {
    const context = setup();
    const { database, routines, habits, finances, journal, measures } = context;
    const routine = routines.create({ name: "Morning", icon: "sunrise", color: "amber", timeOfDay: null, weekdays: [...EVERY_DAY], remindAt: null, steps: [{ name: "Water", durationMinutes: null }, { name: "Stretch", durationMinutes: 5 }] });
    const read = habits.create({ name: "Read", icon: "books", color: "plum", kind: "count", targetCount: 20, unit: "pages", cadence: "daily", weekdays: [...EVERY_DAY], remindAt: null });
    const run = habits.create({ name: "Run", icon: "running-shoe", color: "coral", kind: "count", targetCount: 3, unit: "runs", cadence: "weekly", weekdays: [...EVERY_DAY], remindAt: null });
    database.prepare("UPDATE routines SET created_at = ?").run("2026-09-01T08:00:00.000Z");
    database.prepare("UPDATE habits SET created_at = ?").run("2026-09-01T08:00:00.000Z");
    for (const step of routine.steps) routines.setStep(routine.id, step.id, "2026-03-02", true);
    routines.setStep(routine.id, routine.steps[0]!.id, "2026-03-03", true);
    habits.setEntry({ habitId: read.id, date: "2026-03-02", count: 25 });
    habits.setEntry({ habitId: read.id, date: "2026-03-03", count: 10 });
    habits.setEntry({ habitId: run.id, date: "2026-03-02", count: 1 });
    const checking = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 0 });
    const savings = finances.accounts.create({ name: "Savings", kind: "savings", icon: "money-bag", color: "mint", openingBalanceCents: 0 });
    const groceries = finances.categories.list().find((category) => category.name === "Groceries")!;
    finances.transactions.create({ accountId: checking.id, categoryId: groceries.id, amountCents: -1_250, occurredOn: "2026-03-02", note: "Market" });
    finances.transactions.create({ accountId: checking.id, categoryId: null, amountCents: 10_000, occurredOn: "2026-03-02", note: "Refund" });
    finances.transactions.createTransfer({ fromAccountId: checking.id, toAccountId: savings.id, amountCents: 5_000, occurredOn: "2026-03-02", note: "" });
    journal.save({ date: "2026-03-02", mood: 4, energy: 3, note: "A good day." });
    const weight = measures.create({ name: "Weight", unit: "kg", icon: "gauge", color: "sky", decimals: 1, target: 72, direction: "down" });
    measures.setEntry({ measureId: weight.id, date: "2026-03-02", value: 74.25 });
    return context;
  }

  it("uses local calendar days for creation and archiving", () => {
    const previousZone = process.env.TZ;
    process.env.TZ = "Europe/Madrid";
    try {
      const { database, routines, sources } = setup();
      const routine = routines.create({ name: "Night", icon: "bed", color: "iris", timeOfDay: null, weekdays: [...EVERY_DAY], remindAt: null, steps: [{ name: "Lights off", durationMinutes: null }] });
      database.prepare("UPDATE routines SET created_at = ? WHERE id = ?").run("2026-03-01T23:30:00.000Z", routine.id);
      routines.setStep(routine.id, routine.steps[0]!.id, "2026-03-03", true);
      database.prepare("UPDATE routines SET archived_at = ? WHERE id = ?").run("2026-03-03T23:30:00.000Z", routine.id);
      const [first, second, third, fourth] = summarizeDays(sources, "2026-03-01", "2026-03-04");
      expect(first?.routinesDue).toBe(0);
      expect(second?.routinesDue).toBe(1);
      expect(third).toMatchObject({ routinesDue: 1, routinesDone: 1 });
      expect(fourth?.routinesDue).toBe(0);
      database.close();
    } finally {
      process.env.TZ = previousZone;
    }
  });

  it("counts what was due and done each day, from the first activity on", () => {
    const { database, sources } = seed();
    const [first, second, third] = summarizeDays(sources, "2026-03-01", "2026-03-03");
    expect(first).toMatchObject({ routinesDue: 0, habitsDue: 0, expenseCents: 0, mood: null, hasNote: false });
    expect(second).toMatchObject({ routinesDone: 1, routinesDue: 1, habitsDone: 1, habitsDue: 1, incomeCents: 10_000, expenseCents: 1_250, transactions: 2, measures: 1, mood: 4, energy: 3, hasNote: true });
    expect(third).toMatchObject({ routinesDone: 0, routinesDue: 1, habitsDone: 0, habitsDue: 1, expenseCents: 0 });
    database.close();
  });

  it("lists everything logged on a day, with transfers shown once", () => {
    const { database, sources } = seed();
    const log = buildDayLog(sources, "2026-03-02");
    expect(log.entry?.note).toBe("A good day.");
    expect(log.activity.map((item) => item.kind)).toEqual(["routine", "habit", "habit", "measure", "transaction", "transaction", "transaction"]);
    expect(log.activity.find((item) => item.title === "Read")).toMatchObject({ detail: "25 of 20 pages", done: true });
    expect(log.activity.find((item) => item.title === "Run")).toMatchObject({ detail: "1 logged · 3 runs a week", done: null });
    expect(log.activity.find((item) => item.kind === "measure")?.detail).toBe("74,3 kg");
    expect(log.activity.filter((item) => item.title === "Transfer")).toHaveLength(1);
    expect(log.activity.find((item) => item.title === "Groceries")).toMatchObject({ amountCents: -1_250, detail: "Market · Checking" });
    database.close();
  });

  it("gives Claude a read-only journal tool with a bounded range", async () => {
    const { database, sources } = seed();
    const journalTool = soulTools(sources).find((entry) => entry.name === "journal_and_measures");
    expect(journalTool).toBeDefined();
    const handler = journalTool!.handler as unknown as (args: { from: string; to: string }, extra: unknown) => Promise<{ content: Array<{ text?: string }> }>;
    const read = async (from: string, to: string) => JSON.parse((await handler({ from, to }, undefined)).content[0]?.text ?? "{}") as { journal?: Array<{ note?: string; mood: number }>; error?: string };
    expect((await read("2026-03-01", "2026-03-03")).journal).toEqual([{ date: "2026-03-02", mood: 4, energy: 3, note: "A good day." }]);
    expect((await read("2026-01-01", "2026-06-01")).error).toMatch(/at most 92 days/u);
    expect((await read("2026-03-03", "2026-03-01")).error).toMatch(/at most 92 days/u);
    expect(soulTools(sources).map((entry) => entry.name)).toContain("finance_summary");
    database.close();
  });

  it("shares journal and measures with the assistant, notes only on request", () => {
    const { database, sources } = seed();
    const withNotes = journalAndMeasures(sources, "2026-03-01", "2026-03-03", true) as { journal: Array<{ note?: string }>; measures: Array<{ values: Array<{ value: string }> }> };
    expect(withNotes.journal[0]?.note).toBe("A good day.");
    expect(withNotes.measures[0]?.values[0]?.value).toBe("74,3 kg");
    const withoutNotes = journalAndMeasures(sources, "2026-03-01", "2026-03-03", false) as { journal: Array<{ note?: string }> };
    expect(withoutNotes.journal[0]?.note).toBeUndefined();
    database.close();
  });
});

describe("finance trends", () => {
  it("reports monthly totals and the net worth at each month end", () => {
    const { database, finances } = setup();
    const checking = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 100_000 });
    const savings = finances.accounts.create({ name: "Savings", kind: "savings", icon: "money-bag", color: "mint", openingBalanceCents: 0 });
    finances.transactions.create({ accountId: checking.id, categoryId: null, amountCents: 200_000, occurredOn: "2026-01-28", note: "Salary" });
    finances.transactions.create({ accountId: checking.id, categoryId: null, amountCents: -50_000, occurredOn: "2026-02-03", note: "Rent" });
    finances.transactions.createTransfer({ fromAccountId: checking.id, toAccountId: savings.id, amountCents: 30_000, occurredOn: "2026-02-10", note: "" });
    finances.transactions.create({ accountId: checking.id, categoryId: null, amountCents: -1_000, occurredOn: "2026-03-20", note: "Later" });
    const trends = finances.monthTrends("2026-03", 3, "2026-03-15");
    expect(trends.map((month) => month.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(trends.map((month) => month.netWorthCents)).toEqual([300_000, 250_000, 249_000]);
    expect(trends[1]).toMatchObject({ incomeCents: 0, expenseCents: 50_000, netCents: -50_000 });
    database.close();
  });

  it("suggests past descriptions with their category, most used first", () => {
    const { database, finances } = setup();
    const checking = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 0 });
    const savings = finances.accounts.create({ name: "Savings", kind: "savings", icon: "money-bag", color: "mint", openingBalanceCents: 0 });
    const eatingOut = finances.categories.list().find((category) => category.name === "Eating out")!;
    finances.transactions.create({ accountId: checking.id, categoryId: eatingOut.id, amountCents: -250, occurredOn: "2026-03-01", note: "Coffee" });
    finances.transactions.create({ accountId: checking.id, categoryId: eatingOut.id, amountCents: -280, occurredOn: "2026-03-02", note: "coffee " });
    finances.transactions.create({ accountId: checking.id, categoryId: null, amountCents: -4_000, occurredOn: "2026-03-03", note: "Bike repair" });
    finances.transactions.createTransfer({ fromAccountId: checking.id, toAccountId: savings.id, amountCents: 1_000, occurredOn: "2026-03-04", note: "Monthly transfer" });
    const suggestions = finances.transactions.suggestions();
    expect(suggestions.map((entry) => [entry.note, entry.uses])).toEqual([["coffee", 2], ["Bike repair", 1]]);
    expect(suggestions[0]).toMatchObject({ categoryId: eatingOut.id, amountCents: -280 });
    database.close();
  });
});

describe("assistant context", () => {
  it("summarises the person's data without inventing anything", () => {
    const { database, habits, finances, sources } = setup();
    const account = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 10_000 });
    const groceries = finances.categories.list().find((category) => category.name === "Groceries")!;
    finances.transactions.create({ accountId: account.id, categoryId: groceries.id, amountCents: -2_550, occurredOn: "2026-03-04", note: "Market" });
    const read = habits.create({ name: "Read", icon: "books", color: "plum", kind: "count", targetCount: 20, unit: "pages", cadence: "daily", weekdays: [...EVERY_DAY], remindAt: null });
    habits.setEntry({ habitId: read.id, date: addDays("2026-03-04", -1), count: 25 });
    const data = sources;

    const march = financeSummary(data, "2026-03") as { expenses: string; byCategory: Array<{ category: string }>; accounts: Array<{ name: string }> };
    expect(march.expenses).toContain("25,50");
    expect(march.byCategory[0]?.category).toBe("Groceries");
    expect(march.accounts.map((entry) => entry.name)).toEqual(["Checking"]);
    expect((habitsOverview(data) as Array<{ target: string }>)[0]?.target).toBe("20 pages per day");
    expect(contextPack(data, false)).toMatch(/^Today is \d{4}-\d{2}-\d{2}\./u);
    expect(contextPack(data, true)).toContain("\"thisMonth\"");
    database.close();
  });
});
