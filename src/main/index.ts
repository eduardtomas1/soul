import { app, BrowserWindow, dialog, nativeTheme } from "electron";
import { createAssistantService } from "./assistant/service";
import { createBackupService } from "./backup/service";
import { openDatabase, type SoulDatabase } from "./database/open";
import { registerAssistantHandlers } from "./features/assistant-handlers";
import { registerBackupHandlers } from "./features/backup-handlers";
import { registerDataHandlers } from "./features/data-handlers";
import { createFileGrants } from "./file-grants";
import { createIpcRouter } from "./ipc";
import { resolvePaths } from "./paths";
import { createReminderScheduler } from "./reminders/scheduler";
import { createAssistantRepository } from "./repositories/assistant";
import { createFinancesRepository } from "./repositories/finances";
import { createHabitsRepository, createMedalsRepository } from "./repositories/habits";
import { createJournalRepository } from "./repositories/journal";
import { createMeasuresRepository } from "./repositories/measures";
import { createRoutinesRepository } from "./repositories/routines";
import { createSettingsRepository } from "./repositories/settings";
import { createSecretStore } from "./secrets";
import { createMedalService } from "./services/medals";
import { createMainWindow } from "./window";
import type { DataScope } from "@shared/ipc";
import type { Theme } from "@shared/contracts/settings";

app.setName("Soul");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  start().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("Soul could not start", message);
    app.exit(1);
  });
}

async function start(): Promise<void> {
  await app.whenReady();
  const paths = resolvePaths();
  let database: SoulDatabase | null = openDatabase(paths.databaseFile);
  const current = (): SoulDatabase => {
    if (!database) throw new Error("The database is closed.");
    return database;
  };

  const settings = createSettingsRepository(current());
  const routines = createRoutinesRepository(current());
  const habits = createHabitsRepository(current());
  const medals = createMedalsRepository(current());
  const finances = createFinancesRepository(current());
  const journal = createJournalRepository(current());
  const measures = createMeasuresRepository(current());
  const assistantRepository = createAssistantRepository(current());
  finances.categories.ensureDefaults();
  const medalService = createMedalService(habits, routines, finances, medals);
  const secrets = createSecretStore(paths.secretsFile);
  const router = createIpcRouter();
  const files = createFileGrants();

  applyTheme(settings.get().theme);

  let mainWindow: BrowserWindow | null = null;
  const focusWindow = (): BrowserWindow | null => mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;

  const reminders = createReminderScheduler(routines, habits, settings, focusWindow, (payload) => router.emit("reminder.fired", payload));
  const backup = createBackupService({
    paths,
    secrets,
    settings,
    database: current,
    closeDatabase: () => {
      database?.close();
      database = null;
    },
    emit: (event) => router.emit("backup.event", event),
  });
  const assistant = createAssistantService({
    appVersion: app.getVersion(),
    dataDirectory: paths.dataDirectory,
    repository: assistantRepository,
    settings,
    data: { finances, habits, routines, journal, measures },
    emit: (event) => {
      router.emit("assistant.event", event);
      if (event.kind === "completed") router.changed("assistant");
    },
  });

  registerDataHandlers({
    router,
    paths,
    files,
    settings,
    routines,
    habits,
    medals,
    finances,
    journal,
    measures,
    medalService,
    onSettingsChanged: () => {
      const next = settings.get();
      applyTheme(next.theme);
      applyLoginItem(next.launchAtLogin);
      reminders.reschedule();
    },
  });
  registerBackupHandlers(router, backup, files);
  registerAssistantHandlers(router, assistant, assistantRepository);
  router.assertComplete();

  router.onChanged((scope: DataScope) => {
    if (scope === "routines" || scope === "habits" || scope === "settings") reminders.reschedule();
    if (scope !== "backup" && scope !== "assistant") backup.noteChange();
  });

  const open = (): void => {
    mainWindow = createMainWindow();
    router.attach(mainWindow);
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  };
  open();
  reminders.reschedule();
  backup.start();

  app.on("second-instance", () => {
    const window = focusWindow();
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    } else {
      open();
    }
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) open();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", () => {
    reminders.dispose();
    backup.dispose();
    assistant.dispose();
    database?.close();
    database = null;
  });
}

function applyTheme(theme: Theme): void {
  nativeTheme.themeSource = theme === "natural" ? "light" : theme;
}

function applyLoginItem(enabled: boolean): void {
  if (!app.isPackaged) return;
  try {
    app.setLoginItemSettings({ openAtLogin: enabled });
  } catch {
    return;
  }
}
