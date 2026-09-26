import { app, dialog, shell } from "electron";
import type { FileGrants } from "../file-grants";
import type { IpcRouter } from "../ipc";
import type { SoulPaths } from "../paths";
import type { FinancesRepository } from "../repositories/finances";
import type { HabitsRepository, MedalsRepository } from "../repositories/habits";
import type { JournalRepository } from "../repositories/journal";
import type { MeasuresRepository } from "../repositories/measures";
import type { RoutinesRepository } from "../repositories/routines";
import type { SettingsRepository } from "../repositories/settings";
import type { MedalService } from "../services/medals";
import { registerLogHandlers } from "./log-handlers";
import { buildToday } from "../services/today";
import { dryRunCsv, importCsv, previewCsv } from "../services/csv-import";
import { addMonths, addMonthsToMonth, daysBetween, firstDayOfMonth, monthOf, todayIso } from "@shared/dates";

const MAX_HISTORY_DAYS = 400;
import { projectCashFlow } from "@shared/projection";

export interface DataHandlerDependencies {
  readonly router: IpcRouter;
  readonly paths: SoulPaths;
  readonly files: FileGrants;
  readonly settings: SettingsRepository;
  readonly routines: RoutinesRepository;
  readonly habits: HabitsRepository;
  readonly medals: MedalsRepository;
  readonly finances: FinancesRepository;
  readonly journal: JournalRepository;
  readonly measures: MeasuresRepository;
  readonly medalService: MedalService;
  readonly onSettingsChanged: () => void;
}

export function registerDataHandlers(deps: DataHandlerDependencies): void {
  const { router, routines, habits, medals, finances, settings, medalService, files } = deps;
  const sources = { routines, habits, medals, finances, journal: deps.journal, measures: deps.measures };

  const postDueRecurring = (today: string): void => {
    if (finances.recurring.postDue(today) > 0) router.changed("finances");
  };

  router.handle("app.info", () => ({ version: app.getVersion(), dataDirectory: deps.paths.dataDirectory, platform: process.platform }));
  router.handle("app.openExternal", async ({ url }) => {
    if (!url.startsWith("https://")) throw new Error("Only https links can be opened.");
    await shell.openExternal(url);
  });
  router.handle("app.revealDataDirectory", async () => {
    await shell.openPath(deps.paths.dataDirectory);
  });

  router.handle("settings.get", () => settings.get());
  router.handle("settings.update", (patch) => {
    const next = settings.update(patch);
    deps.onSettingsChanged();
    return next;
  }, "settings");

  router.handle("today.get", ({ date }) => {
    postDueRecurring(todayIso());
    if (medalService.afterPeriodsClosed(todayIso()).length > 0) router.changed("habits");
    return buildToday(date, sources);
  });

  router.handle("routines.list", () => routines.list());
  router.handle("routines.create", (input) => routines.create(input), "routines");
  router.handle("routines.update", ({ id, input }) => routines.update(id, input), "routines");
  router.handle("routines.archive", ({ id, archived }) => routines.setArchived(id, archived), "routines");
  router.handle("routines.delete", ({ id }) => {
    routines.remove(id);
  }, "routines");
  router.handle("routines.reorder", ({ ids }) => {
    routines.reorder(ids);
  }, "routines");
  router.handle("routines.day", ({ date }) => routines.dayStates(date));
  router.handle("routines.setStep", ({ routineId, stepId, date, completed }) => {
    const day = routines.setStep(routineId, stepId, date, completed);
    const routine = routines.get(routineId);
    const newMedals = routine && completed ? medalService.afterRoutineStep(routine, date) : [];
    return { day, newMedals };
  }, "routines");
  router.handle("routines.history", ({ routineId, from, to }) => {
    const span = daysBetween(from, to);
    if (span < 0 || span > MAX_HISTORY_DAYS) throw new Error(`Choose a range of at most ${MAX_HISTORY_DAYS} days.`);
    return routines.history(routineId, from, to);
  });

  router.handle("habits.overview", ({ from, to }) => {
    const list = habits.list();
    const today = todayIso();
    return {
      habits: list,
      entries: habits.entries(from, to),
      stats: list.map((habit) => habits.stats(habit, today)),
      medals: medals.list(),
    };
  });
  router.handle("habits.create", (input) => habits.create(input), "habits");
  router.handle("habits.update", ({ id, input }) => habits.update(id, input), "habits");
  router.handle("habits.archive", ({ id, archived }) => habits.setArchived(id, archived), "habits");
  router.handle("habits.delete", ({ id }) => {
    habits.remove(id);
  }, "habits");
  router.handle("habits.reorder", ({ ids }) => {
    habits.reorder(ids);
  }, "habits");
  router.handle("habits.setEntry", (entry) => {
    const habit = habits.get(entry.habitId);
    if (!habit) throw new Error("Habit not found.");
    const saved = habits.setEntry(entry);
    const today = todayIso();
    const stats = habits.stats(habit, today);
    const newMedals = saved.count > 0 ? medalService.afterHabitEntry(habit, entry.date, today) : [];
    return { entry: saved, stats, newMedals };
  }, "habits");
  router.handle("medals.list", () => medals.list());

  registerLogHandlers(router, sources);

  router.handle("finances.overview", () => {
    const today = todayIso();
    postDueRecurring(today);
    medalService.afterMonthClosed(today);
    const month = monthOf(today);
    const sameDayLastMonth = addMonths(today, -1);
    return {
      accounts: finances.accounts.list(),
      categories: finances.categories.list(),
      budgets: finances.budgets.list(),
      recurringRules: finances.recurring.list(),
      savingsGoals: finances.goals.list(),
      currentMonth: finances.monthSummary(month),
      previousMonth: finances.monthSummary(addMonthsToMonth(month, -1)),
      previousMonthToDate: finances.totalsBetween(firstDayOfMonth(monthOf(sameDayLastMonth)), sameDayLastMonth),
      netWorthCents: finances.netWorthCents(),
    };
  });
  router.handle("finances.transactions.list", (query) => finances.transactions.list(query));
  router.handle("finances.transactions.suggestions", () => finances.transactions.suggestions());
  router.handle("finances.transactions.create", (input) => finances.transactions.create(input), "finances");
  router.handle("finances.transactions.update", ({ id, input }) => finances.transactions.update(id, input), "finances");
  router.handle("finances.transactions.delete", ({ id }) => {
    finances.transactions.remove(id);
  }, "finances");
  router.handle("finances.transfers.create", (input) => finances.transactions.createTransfer(input), "finances");
  router.handle("finances.accounts.create", (input) => finances.accounts.create(input), "finances");
  router.handle("finances.accounts.update", ({ id, input }) => finances.accounts.update(id, input), "finances");
  router.handle("finances.accounts.archive", ({ id, archived }) => finances.accounts.setArchived(id, archived), "finances");
  router.handle("finances.accounts.delete", ({ id }) => {
    finances.accounts.remove(id);
  }, "finances");
  router.handle("finances.categories.create", (input) => finances.categories.create(input), "finances");
  router.handle("finances.categories.update", ({ id, input }) => finances.categories.update(id, input), "finances");
  router.handle("finances.categories.archive", ({ id, archived }) => finances.categories.setArchived(id, archived), "finances");
  router.handle("finances.categories.delete", ({ id }) => {
    finances.categories.remove(id);
  }, "finances");
  router.handle("finances.budgets.set", ({ categoryId, monthlyLimitCents }) => finances.budgets.set(categoryId, monthlyLimitCents), "finances");
  router.handle("finances.recurring.create", (input) => finances.recurring.create(input), "finances");
  router.handle("finances.recurring.update", ({ id, input }) => finances.recurring.update(id, input), "finances");
  router.handle("finances.recurring.delete", ({ id }) => {
    finances.recurring.remove(id);
  }, "finances");
  router.handle("finances.recurring.postDue", () => ({ posted: finances.recurring.postDue(todayIso(), true) }), "finances");
  router.handle("finances.recurring.skipDue", () => ({ skipped: finances.recurring.skipDue(todayIso()) }), "finances");
  router.handle("finances.goals.create", (input) => finances.goals.create(input), "finances");
  router.handle("finances.goals.update", ({ id, input }) => finances.goals.update(id, input), "finances");
  router.handle("finances.goals.delete", ({ id }) => {
    finances.goals.remove(id);
  }, "finances");
  router.handle("finances.goals.contribute", ({ id, amountCents }) => {
    const goal = finances.goals.contribute(id, amountCents);
    return { goal, newMedals: medalService.afterGoalChange(goal.id, goal.achievedAt !== null) };
  }, "finances");
  router.handle("finances.projection", ({ months }) => {
    const today = todayIso();
    return projectCashFlow({
      startingCents: finances.liquidCents(),
      from: today,
      months,
      rules: finances.recurring.list(),
      averageDiscretionaryExpenseCents: finances.averageDiscretionaryExpenseCents(today, 3),
    });
  });
  router.handle("finances.trends", ({ months }) => {
    const today = todayIso();
    return finances.monthTrends(monthOf(today), months, today);
  });
  router.handle("finances.csv.pick", async () => {
    const result = await dialog.showOpenDialog({
      title: "Choose a CSV file",
      properties: ["openFile"],
      filters: [{ name: "CSV", extensions: ["csv", "txt", "tsv"] }],
    });
    const filePath = result.canceled ? undefined : result.filePaths[0];
    return filePath === undefined ? null : files.grant(filePath);
  });
  router.handle("finances.csv.preview", ({ filePath }) => previewCsv(files.require(filePath)));
  router.handle("finances.csv.dryRun", (request) => dryRunCsv({ ...request, filePath: files.require(request.filePath) }, finances));
  router.handle("finances.csv.import", (request) => importCsv({ ...request, filePath: files.require(request.filePath) }, finances), "finances");
}
