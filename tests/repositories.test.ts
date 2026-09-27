import { describe, expect, it } from "vitest";
import { openInMemoryDatabase } from "../src/main/database/open";
import { createFinancesRepository } from "../src/main/repositories/finances";
import { createJournalRepository } from "../src/main/repositories/journal";
import { createMeasuresRepository } from "../src/main/repositories/measures";
import { createRoutinesRepository } from "../src/main/repositories/routines";
import { createSettingsRepository } from "../src/main/repositories/settings";
import { DEFAULT_SETTINGS, settingsPatchSchema } from "../src/shared/contracts/settings";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const;

describe("routines", () => {
  it("only ticks steps that belong to the routine", () => {
    const database = openInMemoryDatabase();
    const routines = createRoutinesRepository(database);
    const morning = routines.create({ name: "Morning", icon: "sunrise", color: "amber", timeOfDay: null, weekdays: [...EVERY_DAY], remindAt: null, steps: [{ name: "Water", durationMinutes: null }] });
    const evening = routines.create({ name: "Evening", icon: "bed", color: "iris", timeOfDay: null, weekdays: [...EVERY_DAY], remindAt: null, steps: [{ name: "Read", durationMinutes: null }] });
    expect(() => routines.setStep(morning.id, evening.steps[0]!.id, "2026-03-01", true)).toThrow(/not part of this routine/u);
    expect(routines.setStep(morning.id, morning.steps[0]!.id, "2026-03-01", true).completedStepIds).toEqual([morning.steps[0]!.id]);
    expect(routines.setStep(morning.id, morning.steps[0]!.id, "2026-03-01", false).completedStepIds).toEqual([]);
    database.close();
  });

  it("counts a day as complete only when every step is done", () => {
    const database = openInMemoryDatabase();
    const routines = createRoutinesRepository(database);
    const routine = routines.create({ name: "Morning", icon: "sunrise", color: "amber", timeOfDay: null, weekdays: [...EVERY_DAY], remindAt: null, steps: [{ name: "Water", durationMinutes: null }, { name: "Stretch", durationMinutes: 5 }] });
    const [water, stretch] = routine.steps;
    routines.setStep(routine.id, water!.id, "2026-03-01", true);
    routines.setStep(routine.id, water!.id, "2026-03-02", true);
    routines.setStep(routine.id, stretch!.id, "2026-03-02", true);
    expect([...routines.completedDates(routine.id, "2026-03-01", "2026-03-02")]).toEqual(["2026-03-02"]);
    const history = routines.history(routine.id, "2026-03-01", "2026-03-02");
    expect(history.map((day) => day.completedSteps)).toEqual([1, 2]);
    database.close();
  });
});

describe("finances", () => {
  function setup() {
    const database = openInMemoryDatabase();
    const finances = createFinancesRepository(database);
    finances.categories.ensureDefaults();
    const checking = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 100_000 });
    const savings = finances.accounts.create({ name: "Savings", kind: "savings", icon: "money-bag", color: "mint", openingBalanceCents: 0 });
    return { database, finances, checking, savings };
  }

  it("posts manual rules only when asked to", () => {
    const { database, finances, checking } = setup();
    finances.recurring.create({ name: "Rent", accountId: checking.id, categoryId: null, amountCents: -90_000, frequency: "monthly", interval: 1, anchorDate: "2026-01-01", endDate: null, autoPost: false });
    expect(finances.recurring.postDue("2026-02-15")).toBe(0);
    expect(finances.recurring.postDue("2026-02-15", true)).toBe(2);
    expect(finances.recurring.list()[0]?.nextDueOn).toBe("2026-03-01");
    expect(finances.accounts.get(checking.id)?.balanceCents).toBe(-80_000);
    database.close();
  });

  it("skips due manual payments without recording them", () => {
    const { database, finances, checking } = setup();
    finances.recurring.create({ name: "Rent", accountId: checking.id, categoryId: null, amountCents: -90_000, frequency: "monthly", interval: 1, anchorDate: "2026-01-01", endDate: null, autoPost: false });
    finances.recurring.create({ name: "Salary", accountId: checking.id, categoryId: null, amountCents: 200_000, frequency: "monthly", interval: 1, anchorDate: "2026-03-28", endDate: null, autoPost: true });
    expect(finances.recurring.skipDue("2026-02-15")).toBe(2);
    expect(finances.recurring.skipDue("2026-02-15")).toBe(0);
    const rules = new Map(finances.recurring.list().map((rule) => [rule.name, rule.nextDueOn]));
    expect(rules.get("Rent")).toBe("2026-03-01");
    expect(rules.get("Salary")).toBe("2026-03-28");
    expect(finances.transactions.list({ limit: 10 })).toHaveLength(0);
    expect(finances.recurring.postDue("2026-03-01", true)).toBe(1);
    database.close();
  });

  it("does not re-post history when an ended rule's schedule is edited", () => {
    const { database, finances, checking } = setup();
    const gym = finances.recurring.create({ name: "Gym", accountId: checking.id, categoryId: null, amountCents: -3_900, frequency: "monthly", interval: 1, anchorDate: "2026-01-15", endDate: "2026-09-30", autoPost: true });
    expect(finances.recurring.postDue("2026-09-20")).toBe(9);
    const edit = { name: "Gym", accountId: checking.id, categoryId: null, amountCents: -3_900, frequency: "monthly" as const, interval: 2, anchorDate: "2026-01-15", endDate: "2026-09-30", autoPost: true };
    finances.recurring.update(gym.id, edit);
    expect(finances.recurring.postDue("2026-09-26")).toBe(0);
    finances.recurring.update(gym.id, { ...edit, interval: 1, anchorDate: "2026-01-20" });
    expect(finances.recurring.postDue("2026-09-26")).toBe(0);
    expect(finances.transactions.list({ search: "Gym", limit: 50 })).toHaveLength(9);
    database.close();
  });

  it("posts only real occurrences when an ended rule is extended", () => {
    const { database, finances, checking } = setup();
    const input = { name: "Phone", accountId: checking.id, categoryId: null, amountCents: -1_800, frequency: "monthly" as const, interval: 1, anchorDate: "2026-01-15", endDate: "2026-06-30", autoPost: true };
    const phone = finances.recurring.create(input);
    expect(finances.recurring.postDue("2026-09-26")).toBe(6);
    finances.recurring.update(phone.id, { ...input, endDate: "2026-12-31" });
    expect(finances.recurring.postDue("2026-09-26")).toBe(3);
    const dates = finances.transactions.list({ search: "Phone", limit: 50 }).map((transaction) => transaction.occurredOn).sort();
    expect(dates.slice(-3)).toEqual(["2026-07-15", "2026-08-15", "2026-09-15"]);
    expect(finances.recurring.list()[0]?.nextDueOn).toBe("2026-10-15");
    database.close();
  });

  it("finds transactions regardless of case and accents", () => {
    const { database, finances, checking } = setup();
    finances.transactions.create({ accountId: checking.id, categoryId: null, amountCents: -450, occurredOn: "2026-03-01", note: "Café con ÁLVARO" });
    expect(finances.transactions.list({ search: "cafe", limit: 10 })).toHaveLength(1);
    expect(finances.transactions.list({ search: "álvaro", limit: 10 })).toHaveLength(1);
    expect(finances.transactions.list({ search: "té", limit: 10 })).toHaveLength(0);
    database.close();
  });

  it("keeps an archived account in the net worth of the days before it was archived", () => {
    const { database, finances, checking } = setup();
    const old = finances.accounts.create({ name: "Old bank", kind: "checking", icon: "bank", color: "slate", openingBalanceCents: 500_000 });
    finances.transactions.createTransfer({ fromAccountId: old.id, toAccountId: checking.id, amountCents: 500_000, occurredOn: "2026-06-10", note: "" });
    database.prepare("UPDATE accounts SET archived_at = ? WHERE id = ?").run("2026-06-20T10:00:00.000Z", old.id);
    expect(finances.monthTrends("2026-07", 4, "2026-07-15").map((month) => month.netWorthCents)).toEqual([600_000, 600_000, 600_000, 600_000]);
    database.close();
  });

  it("stops posting after the end date", () => {
    const { database, finances, checking } = setup();
    finances.recurring.create({ name: "Course", accountId: checking.id, categoryId: null, amountCents: -5_000, frequency: "weekly", interval: 1, anchorDate: "2026-03-02", endDate: "2026-03-16", autoPost: true });
    expect(finances.recurring.postDue("2026-06-01")).toBe(3);
    expect(finances.recurring.postDue("2026-06-01")).toBe(0);
    database.close();
  });

  it("deletes both sides of a transfer and keeps transfers out of spending", () => {
    const { database, finances, checking, savings } = setup();
    const [outgoing] = finances.transactions.createTransfer({ fromAccountId: checking.id, toAccountId: savings.id, amountCents: 25_000, occurredOn: "2026-03-04", note: "" });
    expect(finances.monthSummary("2026-03").expenseCents).toBe(0);
    expect(finances.netWorthCents()).toBe(100_000);
    finances.transactions.remove(outgoing!.id);
    expect(finances.transactions.list({ limit: 10 })).toHaveLength(0);
    expect(finances.accounts.get(savings.id)?.balanceCents).toBe(0);
    expect(() => finances.transactions.createTransfer({ fromAccountId: checking.id, toAccountId: checking.id, amountCents: 1, occurredOn: "2026-03-04", note: "" })).toThrow();
    database.close();
  });

  it("finds duplicates and searches notes literally", () => {
    const { database, finances, checking } = setup();
    finances.transactions.create({ accountId: checking.id, categoryId: null, amountCents: -1_000, occurredOn: "2026-03-04", note: "100% cotton" });
    finances.transactions.create({ accountId: checking.id, categoryId: null, amountCents: -2_000, occurredOn: "2026-03-05", note: "1000 cotton" });
    expect(finances.transactions.exists(checking.id, "2026-03-04", -1_000, "100% cotton")).toBe(true);
    expect(finances.transactions.exists(checking.id, "2026-03-04", -1_000, "other")).toBe(false);
    expect(finances.transactions.list({ search: "100%", limit: 10 }).map((entry) => entry.note)).toEqual(["100% cotton"]);
    database.close();
  });

  it("tracks savings goals and budgets", () => {
    const { database, finances, checking } = setup();
    const goal = finances.goals.create({ name: "Bike", icon: "bicycle", color: "amber", targetCents: 10_000, targetDate: null });
    expect(finances.goals.contribute(goal.id, 6_000).achievedAt).toBeNull();
    expect(finances.goals.contribute(goal.id, 4_000).achievedAt).not.toBeNull();
    expect(finances.goals.contribute(goal.id, -20_000).savedCents).toBe(0);
    const groceries = finances.categories.list().find((category) => category.name === "Groceries")!;
    finances.budgets.set(groceries.id, 30_000);
    finances.transactions.create({ accountId: checking.id, categoryId: groceries.id, amountCents: -12_345, occurredOn: "2026-03-10", note: "" });
    expect(finances.monthSummary("2026-03").byCategory).toEqual([{ categoryId: groceries.id, spentCents: 12_345, limitCents: 30_000 }]);
    expect(finances.budgets.set(groceries.id, null)).toEqual([]);
    database.close();
  });
});

describe("settings", () => {
  it("falls back to defaults and merges patches", () => {
    const database = openInMemoryDatabase();
    const settings = createSettingsRepository(database);
    expect(settings.get()).toEqual(DEFAULT_SETTINGS);
    expect(settings.update({ theme: "dark" }).theme).toBe("dark");
    expect(settings.get().remindersEnabled).toBe(true);
    database.prepare("UPDATE settings SET value = ? WHERE key = 'settings'").run(JSON.stringify({ theme: "sepia", remindersEnabled: false }));
    expect(settings.get()).toEqual(DEFAULT_SETTINGS);
    database.close();
  });

  it("moves the retired natural theme to slate and keeps the other settings", () => {
    const database = openInMemoryDatabase();
    const settings = createSettingsRepository(database);
    settings.update({ remindersEnabled: false, onboardingDone: true });
    database.prepare("UPDATE settings SET value = json_set(value, '$.theme', 'natural') WHERE key = 'settings'").run();
    expect(settings.get()).toEqual({ ...DEFAULT_SETTINGS, theme: "slate", remindersEnabled: false, onboardingDone: true });
    expect(settings.update({ launchAtLogin: true }).theme).toBe("slate");
    database.close();
  });

  it("only accepts model names that are safe to pass to a provider", () => {
    expect(settingsPatchSchema.safeParse({ assistantModel: "claude-opus-5-5" }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ assistantModel: "openai/gpt-5.5:high" }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ assistantModel: "" }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ assistantModel: "gpt & calc" }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ assistantModel: "\"quoted\"" }).success).toBe(false);
  });
});

describe("journal", () => {
  it("saves one entry per day and removes it once it is empty", () => {
    const database = openInMemoryDatabase();
    const journal = createJournalRepository(database);
    expect(journal.save({ date: "2026-03-01", mood: 4, energy: null, note: "" })).toMatchObject({ mood: 4, energy: null, note: "" });
    expect(journal.save({ date: "2026-03-01", mood: 4, energy: 2, note: "Slept badly. " })).toMatchObject({ energy: 2, note: "Slept badly. " });
    expect(journal.list("2026-03-01", "2026-03-31")).toHaveLength(1);
    expect(journal.save({ date: "2026-03-01", mood: null, energy: null, note: "   " })).toBeNull();
    expect(journal.get("2026-03-01")).toBeNull();
    database.close();
  });

  it("merges partial saves so one editor never wipes another's fields", () => {
    const database = openInMemoryDatabase();
    const journal = createJournalRepository(database);
    journal.save({ date: "2026-03-01", note: "Morning: gym. Evening: dinner with friends." });
    expect(journal.save({ date: "2026-03-01", mood: 4 })).toMatchObject({ mood: 4, energy: null, note: "Morning: gym. Evening: dinner with friends." });
    expect(journal.save({ date: "2026-03-01", energy: 2 })).toMatchObject({ mood: 4, energy: 2 });
    expect(journal.save({ date: "2026-03-01", note: "   " })).toMatchObject({ mood: 4, note: "" });
    expect(journal.save({ date: "2026-03-01", mood: null, energy: null })).toBeNull();
    database.close();
  });

  it("searches notes literally, newest first", () => {
    const database = openInMemoryDatabase();
    const journal = createJournalRepository(database);
    journal.save({ date: "2026-03-01", mood: null, energy: null, note: "Ran 5k at 100% effort" });
    journal.save({ date: "2026-03-05", mood: null, energy: null, note: "Another 5k" });
    journal.save({ date: "2026-03-09", mood: null, energy: null, note: "Rest day" });
    expect(journal.search("5k", 10).map((entry) => entry.date)).toEqual(["2026-03-05", "2026-03-01"]);
    expect(journal.search("0%", 10).map((entry) => entry.date)).toEqual(["2026-03-01"]);
    expect(journal.search("_", 10)).toEqual([]);
    expect(journal.search("  ", 10)).toEqual([]);
    database.close();
  });

  it("finds notes regardless of case and accents", () => {
    const database = openInMemoryDatabase();
    const journal = createJournalRepository(database);
    journal.save({ date: "2026-03-01", note: "Cena con Álvaro en el café" });
    expect(journal.search("álvaro", 10)).toHaveLength(1);
    expect(journal.search("ALVARO", 10)).toHaveLength(1);
    expect(journal.search("cafe", 10)).toHaveLength(1);
    expect(journal.search("té", 10)).toEqual([]);
    database.close();
  });
});

describe("measures", () => {
  it("rounds values to the measure's precision and clears them", () => {
    const database = openInMemoryDatabase();
    const measures = createMeasuresRepository(database);
    const weight = measures.create({ name: "Weight", unit: " kg ", icon: "gauge", color: "sky", decimals: 1, target: 72, direction: "down" });
    expect(weight.unit).toBe("kg");
    expect(measures.setEntry({ measureId: weight.id, date: "2026-03-01", value: 74.26 })?.value).toBe(74.3);
    measures.setEntry({ measureId: weight.id, date: "2026-03-01", value: 74.1 });
    expect(measures.entries("2026-03-01", "2026-03-01")).toEqual([{ measureId: weight.id, date: "2026-03-01", value: 74.1 }]);
    expect(measures.setEntry({ measureId: weight.id, date: "2026-03-01", value: null })).toBeNull();
    expect(measures.entries("2026-03-01", "2026-03-01")).toEqual([]);
    expect(() => measures.setEntry({ measureId: "missing", date: "2026-03-01", value: 1 })).toThrow(/not found/u);
    database.close();
  });

  it("updates, archives and deletes measures with their entries", () => {
    const database = openInMemoryDatabase();
    const measures = createMeasuresRepository(database);
    const sleep = measures.create({ name: "Sleep", unit: "h", icon: "bed", color: "iris", decimals: 1, target: 8, direction: "up" });
    const steps = measures.create({ name: "Steps", unit: "", icon: "footprints", color: "mint", decimals: 0, target: null, direction: "none" });
    expect(steps.unit).toBeNull();
    expect(measures.list().map((measure) => measure.name)).toEqual(["Sleep", "Steps"]);
    expect(measures.update(sleep.id, { name: "Sleep time", unit: "h", icon: "bed", color: "iris", decimals: 2, target: 7.5, direction: "none" })).toMatchObject({ name: "Sleep time", decimals: 2, target: 7.5, direction: "none" });
    expect(measures.setArchived(sleep.id, true).archivedAt).not.toBeNull();
    measures.setEntry({ measureId: steps.id, date: "2026-03-01", value: 8_000 });
    measures.remove(steps.id);
    expect(measures.entries("2026-01-01", "2026-12-31")).toEqual([]);
    database.close();
  });
});
