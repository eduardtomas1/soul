import { app, dialog } from "electron";
import { readFile, writeFile, rename, copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BackupEvent, BackupMode, BackupStatus, RestoreRequest } from "@shared/contracts/backup";
import { todayIso } from "@shared/dates";
import type { SoulDatabase } from "../database/open";
import { CURRENT_SCHEMA_VERSION } from "../database/migrations";
import { openDatabase, checkIntegrity } from "../database/open";
import type { SoulPaths } from "../paths";
import type { SecretStore } from "../secrets";
import type { SettingsRepository } from "../repositories/settings";
import { decodeBackup, encodeBackup, readBackupHeader } from "./format";
import { snapshotDatabase } from "./snapshot";
import { authorizeWithLoopback, refreshAccessToken, type DriveClient, type DriveTokens } from "../drive/oauth";
import { createFile, downloadFile, findFileByName, getFile, overwriteFile } from "../drive/files";

const DRIVE_FILE_NAME = "Soul backup.soul";
const SECRET_CLIENT_ID = "drive.clientId";
const SECRET_CLIENT_SECRET = "drive.clientSecret";
const SECRET_REFRESH_TOKEN = "drive.refreshToken";
const SECRET_PASSPHRASE = "backup.passphrase";
const KEY_DRIVE_EMAIL = "drive.accountEmail";
const KEY_DRIVE_FILE_ID = "drive.fileId";
const KEY_LAST_UPLOAD = "backup.lastUploadAt";
const KEY_LAST_EXPORT = "backup.lastExportAt";
const KEY_LAST_ERROR = "backup.lastError";
const KEY_MODE = "backup.mode";
const ON_CHANGE_DELAY_MS = 3 * 60_000;
const DAILY_INTERVAL_MS = 24 * 60 * 60_000;

export interface BackupServiceDependencies {
  readonly paths: SoulPaths;
  readonly secrets: SecretStore;
  readonly settings: SettingsRepository;
  readonly database: () => SoulDatabase;
  readonly closeDatabase: () => void;
  readonly emit: (event: BackupEvent) => void;
}

export interface BackupService {
  readonly status: () => BackupStatus;
  readonly setPassphrase: (passphrase: string | null) => BackupStatus;
  readonly setMode: (mode: BackupMode) => BackupStatus;
  readonly exportToFile: () => Promise<{ path: string } | null>;
  readonly pickRestoreFile: () => Promise<string | null>;
  readonly inspectFile: (filePath: string) => Promise<{ encrypted: boolean; createdAt: string | null; appVersion: string | null }>;
  readonly restore: (request: RestoreRequest) => Promise<void>;
  readonly setDriveClient: (client: DriveClient | null) => BackupStatus;
  readonly connectDrive: () => Promise<BackupStatus>;
  readonly cancelConnect: () => void;
  readonly disconnectDrive: () => BackupStatus;
  readonly uploadNow: () => Promise<BackupStatus>;
  readonly noteChange: () => void;
  readonly start: () => void;
  readonly dispose: () => void;
}

export function createBackupService(deps: BackupServiceDependencies): BackupService {
  let busy = false;
  let changeTimer: NodeJS.Timeout | null = null;
  let dailyTimer: NodeJS.Timeout | null = null;
  let cachedTokens: DriveTokens | null = null;
  let signIn: AbortController | null = null;

  function mode(): BackupMode {
    const raw = deps.settings.getRaw(KEY_MODE);
    return raw === "daily" || raw === "on-change" ? raw : "off";
  }

  function driveClient(): DriveClient | null {
    const clientId = deps.secrets.get(SECRET_CLIENT_ID);
    const clientSecret = deps.secrets.get(SECRET_CLIENT_SECRET);
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }

  function status(): BackupStatus {
    return {
      passphraseSet: deps.secrets.has(SECRET_PASSPHRASE),
      mode: mode(),
      drive: {
        clientConfigured: driveClient() !== null,
        connected: deps.secrets.has(SECRET_REFRESH_TOKEN),
        accountEmail: deps.settings.getRaw(KEY_DRIVE_EMAIL),
        fileName: DRIVE_FILE_NAME,
        lastUploadAt: deps.settings.getRaw(KEY_LAST_UPLOAD),
        lastError: deps.settings.getRaw(KEY_LAST_ERROR),
      },
      lastLocalExportAt: deps.settings.getRaw(KEY_LAST_EXPORT),
      busy,
    };
  }

  function encode(): Buffer {
    const database = snapshotDatabase(deps.database(), deps.paths.backupsDirectory);
    return encodeBackup({
      database,
      appVersion: app.getVersion(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      passphrase: deps.secrets.get(SECRET_PASSPHRASE),
    });
  }

  async function accessToken(): Promise<string> {
    const client = driveClient();
    const refreshToken = deps.secrets.get(SECRET_REFRESH_TOKEN);
    if (!client || !refreshToken) throw new Error("Google Drive is not connected.");
    if (cachedTokens && cachedTokens.expiresAt > Date.now()) return cachedTokens.accessToken;
    cachedTokens = await refreshAccessToken(client, refreshToken);
    return cachedTokens.accessToken;
  }

  async function withBusy<T>(work: () => Promise<T>): Promise<T> {
    if (busy) throw new Error("A backup operation is already running.");
    busy = true;
    try {
      return await work();
    } finally {
      busy = false;
    }
  }

  async function upload(): Promise<void> {
    deps.emit({ kind: "progress", label: "Preparing backup" });
    const content = encode();
    const token = await accessToken();
    deps.emit({ kind: "progress", label: "Uploading to Google Drive" });
    const knownId = deps.settings.getRaw(KEY_DRIVE_FILE_ID);
    let existing = knownId ? await getFile(token, knownId) : null;
    if (!existing) existing = await findFileByName(token, DRIVE_FILE_NAME);
    const file = existing ? await overwriteFile(token, existing.id, content) : await createFile(token, DRIVE_FILE_NAME, content);
    deps.settings.setRaw(KEY_DRIVE_FILE_ID, file.id);
    const now = new Date().toISOString();
    deps.settings.setRaw(KEY_LAST_UPLOAD, now);
    deps.settings.setRaw(KEY_LAST_ERROR, null);
    deps.emit({ kind: "uploaded", at: now });
  }

  async function uploadQuietly(): Promise<void> {
    if (busy || !deps.secrets.has(SECRET_REFRESH_TOKEN) || mode() === "off") return;
    try {
      await withBusy(upload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backup failed.";
      deps.settings.setRaw(KEY_LAST_ERROR, message);
      deps.emit({ kind: "failed", message });
    }
  }

  function scheduleDaily(): void {
    if (dailyTimer) clearTimeout(dailyTimer);
    dailyTimer = null;
    if (mode() !== "daily" || !deps.secrets.has(SECRET_REFRESH_TOKEN)) return;
    const last = deps.settings.getRaw(KEY_LAST_UPLOAD);
    const due = last ? new Date(last).getTime() + DAILY_INTERVAL_MS : Date.now() + 30_000;
    dailyTimer = setTimeout(() => {
      void uploadQuietly().then(scheduleDaily);
    }, Math.max(30_000, due - Date.now()));
    dailyTimer.unref();
  }

  async function restoreFromBuffer(buffer: Buffer, passphrase: string | null): Promise<void> {
    const stored = deps.secrets.get(SECRET_PASSPHRASE);
    let decoded;
    try {
      decoded = decodeBackup(buffer, passphrase && passphrase.length > 0 ? passphrase : stored);
    } catch (error) {
      if (passphrase && stored && passphrase !== stored) decoded = decodeBackup(buffer, stored);
      else throw error;
    }
    if (decoded.header.schemaVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error("This backup comes from a newer version of Soul. Update Soul first.");
    }
    const staging = join(deps.paths.backupsDirectory, `restore-${Date.now()}.sqlite`);
    await writeFile(staging, decoded.database);
    let problem: Error | null = null;
    try {
      const probe = openDatabase(staging);
      try {
        if (!checkIntegrity(probe)) problem = new Error("The backup database failed its integrity check.");
      } finally {
        probe.close();
      }
    } catch (error) {
      problem = error instanceof Error ? error : new Error("The backup database could not be opened.");
    }
    for (const suffix of ["-wal", "-shm"]) await rm(`${staging}${suffix}`, { force: true });
    if (problem) {
      await rm(staging, { force: true });
      throw problem;
    }
    deps.closeDatabase();
    const current = deps.paths.databaseFile;
    if (existsSync(current)) await copyFile(current, join(deps.paths.backupsDirectory, `before-restore-${Date.now()}.sqlite`));
    for (const suffix of ["", "-wal", "-shm"]) await rm(`${current}${suffix}`, { force: true });
    await rename(staging, current);
    deps.emit({ kind: "restored" });
    app.relaunch();
    app.exit(0);
  }

  return {
    status,
    setPassphrase(passphrase) {
      deps.secrets.set(SECRET_PASSPHRASE, passphrase);
      return status();
    },
    setMode(next) {
      deps.settings.setRaw(KEY_MODE, next);
      scheduleDaily();
      return status();
    },
    async exportToFile() {
      const result = await dialog.showSaveDialog({
        title: "Export a Soul backup",
        defaultPath: join(app.getPath("documents"), `Soul backup ${todayIso()}.soul`),
        filters: [{ name: "Soul backup", extensions: ["soul"] }],
      });
      if (result.canceled || !result.filePath) return null;
      const path = result.filePath;
      await withBusy(async () => {
        await writeFile(path, encode());
      });
      deps.settings.setRaw(KEY_LAST_EXPORT, new Date().toISOString());
      return { path };
    },
    async pickRestoreFile() {
      const result = await dialog.showOpenDialog({
        title: "Choose a Soul backup",
        properties: ["openFile"],
        filters: [{ name: "Soul backup", extensions: ["soul"] }],
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    async inspectFile(filePath) {
      const { header } = readBackupHeader(await readFile(filePath));
      return { encrypted: header.encrypted, createdAt: header.createdAt ?? null, appVersion: header.appVersion ?? null };
    },
    restore(request) {
      return withBusy(async () => {
        if (request.source === "file") {
          if (!request.filePath) throw new Error("Choose a backup file first.");
          await restoreFromBuffer(await readFile(request.filePath), request.passphrase ?? null);
          return;
        }
        deps.emit({ kind: "progress", label: "Downloading from Google Drive" });
        const token = await accessToken();
        const knownId = deps.settings.getRaw(KEY_DRIVE_FILE_ID);
        const file = (knownId ? await getFile(token, knownId) : null) ?? (await findFileByName(token, DRIVE_FILE_NAME));
        if (!file) throw new Error("There is no Soul backup in this Google Drive yet.");
        await restoreFromBuffer(await downloadFile(token, file.id), request.passphrase ?? null);
      });
    },
    setDriveClient(client) {
      deps.secrets.set(SECRET_CLIENT_ID, client?.clientId ?? null);
      deps.secrets.set(SECRET_CLIENT_SECRET, client?.clientSecret ?? null);
      if (!client) {
        deps.secrets.set(SECRET_REFRESH_TOKEN, null);
        deps.settings.setRaw(KEY_DRIVE_EMAIL, null);
        cachedTokens = null;
      }
      return status();
    },
    connectDrive() {
      return withBusy(async () => {
        const client = driveClient();
        if (!client) throw new Error("Add your Google OAuth client first.");
        deps.emit({ kind: "progress", label: "Waiting for Google sign-in" });
        signIn = new AbortController();
        const { tokens, email } = await authorizeWithLoopback(client, signIn.signal).finally(() => {
          signIn = null;
        });
        deps.secrets.set(SECRET_REFRESH_TOKEN, tokens.refreshToken);
        deps.settings.setRaw(KEY_DRIVE_EMAIL, email);
        deps.settings.setRaw(KEY_LAST_ERROR, null);
        cachedTokens = tokens;
        if (mode() === "off") deps.settings.setRaw(KEY_MODE, "on-change");
        scheduleDaily();
        return status();
      });
    },
    cancelConnect() {
      signIn?.abort();
    },
    disconnectDrive() {
      deps.secrets.set(SECRET_REFRESH_TOKEN, null);
      deps.settings.setRaw(KEY_DRIVE_EMAIL, null);
      deps.settings.setRaw(KEY_DRIVE_FILE_ID, null);
      cachedTokens = null;
      scheduleDaily();
      return status();
    },
    async uploadNow() {
      try {
        await withBusy(upload);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Backup failed.";
        deps.settings.setRaw(KEY_LAST_ERROR, message);
        deps.emit({ kind: "failed", message });
        throw error;
      }
      return status();
    },
    noteChange() {
      if (mode() !== "on-change" || !deps.secrets.has(SECRET_REFRESH_TOKEN)) return;
      if (changeTimer) clearTimeout(changeTimer);
      changeTimer = setTimeout(() => {
        changeTimer = null;
        void uploadQuietly();
      }, ON_CHANGE_DELAY_MS);
      changeTimer.unref();
    },
    start() {
      scheduleDaily();
    },
    dispose() {
      signIn?.abort();
      if (changeTimer) clearTimeout(changeTimer);
      if (dailyTimer) clearTimeout(dailyTimer);
    },
  };
}
