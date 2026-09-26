import Database from "better-sqlite3";
import { foldText } from "@shared/text";
import { runMigrations } from "./migrations";

export type SoulDatabase = Database.Database;

function registerFunctions(database: SoulDatabase): void {
  database.function("soul_fold", { deterministic: true }, (value: unknown) => (typeof value === "string" ? foldText(value) : value));
}

export function openDatabase(filePath: string): SoulDatabase {
  const database = new Database(filePath);
  try {
    registerFunctions(database);
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
    database.pragma("synchronous = NORMAL");
    database.pragma("busy_timeout = 5000");
    database.pragma("temp_store = MEMORY");
    runMigrations(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function openInMemoryDatabase(): SoulDatabase {
  const database = new Database(":memory:");
  registerFunctions(database);
  database.pragma("foreign_keys = ON");
  runMigrations(database);
  return database;
}

export function checkIntegrity(database: SoulDatabase): boolean {
  const rows = database.pragma("integrity_check") as Array<{ integrity_check: string }>;
  return rows.length === 1 && rows[0]?.integrity_check === "ok";
}
