import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { openInMemoryDatabase } from "../src/main/database/open";
import { CURRENT_SCHEMA_VERSION, MIGRATIONS, currentVersion, runMigrations } from "../src/main/database/migrations";
import { createFinancesRepository } from "../src/main/repositories/finances";
import { createHabitsRepository, createMedalsRepository } from "../src/main/repositories/habits";
import { createRoutinesRepository } from "../src/main/repositories/routines";

describe("database", () => {
  it("migrates a fresh database to the current schema", () => {
    const database = openInMemoryDatabase();
    expect(currentVersion(database)).toBe(CURRENT_SCHEMA_VERSION);
    const tables = database.prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row.name);
    expect(tables).toContain("routines");
    expect(tables).toContain("habit_entries");
    expect(tables).toContain("transactions");
    expect(tables).toContain("journal_entries");
    expect(tables).toContain("measure_entries");
    database.close();
  });

  it("upgrades a database made by the first release without losing data", () => {
    const database = new Database(":memory:");
    database.exec(MIGRATIONS[0]!.sql);
    database.pragma("user_version = 1");
    database.prepare("INSERT INTO settings (key, value) VALUES ('theme', '\"dark\"')").run();
    runMigrations(database);
    expect(currentVersion(database)).toBe(CURRENT_SCHEMA_VERSION);
    expect(database.prepare<[], { value: string }>("SELECT value FROM settings WHERE key = 'theme'").get()?.value).toBe("\"dark\"");
    expect(database.prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM journal_entries").get()?.count).toBe(0);
    const columns = database.prepare<[], { name: string }>("PRAGMA table_info(measures)").all().map((column) => column.name);
    expect(columns).toContain("direction");
    database.close();
  });

  it("keeps account balances in sync with transactions and transfers", () => {
    const database = openInMemoryDatabase();
    const finances = createFinancesRepository(database);
    finances.categories.ensureDefaults();
    const checking = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 100_000 });
    const savings = finances.accounts.create({ name: "Savings", kind: "savings", icon: "money-bag", color: "mint", openingBalanceCents: 0 });
    const groceries = finances.categories.list().find((category) => category.name === "Groceries")!;
    finances.transactions.create({ accountId: checking.id, categoryId: groceries.id, amountCents: -2_550, occurredOn: "2026-03-03", note: "Market" });
    finances.transactions.createTransfer({ fromAccountId: checking.id, toAccountId: savings.id, amountCents: 30_000, occurredOn: "2026-03-04", note: "Save" });
    const accounts = finances.accounts.list();
    expect(accounts.find((account) => account.id === checking.id)?.balanceCents).toBe(67_450);
    expect(accounts.find((account) => account.id === savings.id)?.balanceCents).toBe(30_000);
    const summary = finances.monthSummary("2026-03");
    expect(summary.expenseCents).toBe(2_550);
    expect(summary.incomeCents).toBe(0);
    expect(finances.netWorthCents()).toBe(97_450);
    database.close();
  });

  it("posts due recurring rules once and advances them", () => {
    const database = openInMemoryDatabase();
    const finances = createFinancesRepository(database);
    const account = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 0 });
    const rule = finances.recurring.create({ name: "Rent", accountId: account.id, categoryId: null, amountCents: -90_000, frequency: "monthly", interval: 1, anchorDate: "2026-01-01", endDate: null, autoPost: true });
    expect(rule.nextDueOn).toBe("2026-01-01");
    expect(finances.recurring.postDue("2026-03-15")).toBe(3);
    expect(finances.recurring.postDue("2026-03-15")).toBe(0);
    expect(finances.recurring.list()[0]?.nextDueOn).toBe("2026-04-01");
    expect(finances.accounts.list()[0]?.balanceCents).toBe(-270_000);
    database.close();
  });

  it("tracks routine steps per day and habit entries with medals", () => {
    const database = openInMemoryDatabase();
    const routines = createRoutinesRepository(database);
    const habits = createHabitsRepository(database);
    const medals = createMedalsRepository(database);
    const routine = routines.create({ name: "Morning", icon: "sunrise", color: "amber", timeOfDay: "07:00", weekdays: [0, 1, 2, 3, 4, 5, 6], remindAt: null, steps: [{ name: "Water", durationMinutes: null }, { name: "Stretch", durationMinutes: 10 }] });
    const step = routine.steps[0]!;
    const day = routines.setStep(routine.id, step.id, "2026-03-01", true);
    expect(day.completedStepIds).toEqual([step.id]);
    const updated = routines.update(routine.id, { name: "Morning", icon: "sunrise", color: "amber", timeOfDay: "07:00", weekdays: [0, 1, 2, 3, 4], remindAt: "06:45", steps: [{ id: step.id, name: "Water first", durationMinutes: 2 }] });
    expect(updated.steps).toHaveLength(1);
    expect(updated.steps[0]?.name).toBe("Water first");
    const habit = habits.create({ name: "Read", icon: "books", color: "iris", kind: "count", targetCount: 20, unit: "pages", cadence: "daily", weekdays: [0, 1, 2, 3, 4, 5, 6], remindAt: null });
    habits.setEntry({ habitId: habit.id, date: "2026-03-01", count: 25 });
    expect(habits.entries("2026-03-01", "2026-03-01")).toHaveLength(1);
    expect(medals.award("first-step", "habit", habit.id)).not.toBeNull();
    expect(medals.award("first-step", "habit", habit.id)).toBeNull();
    expect(medals.list()[0]?.subjectName).toBe("Read");
    database.close();
  });
});
