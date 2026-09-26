import { app } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export interface SoulPaths {
  readonly dataDirectory: string;
  readonly databaseFile: string;
  readonly secretsFile: string;
  readonly backupsDirectory: string;
}

export function resolvePaths(): SoulPaths {
  const dataDirectory = process.env.SOUL_DATA_DIR && process.env.SOUL_DATA_DIR.length > 0
    ? process.env.SOUL_DATA_DIR
    : join(app.getPath("userData"), "data");
  mkdirSync(dataDirectory, { recursive: true });
  const backupsDirectory = join(dataDirectory, "backups");
  mkdirSync(backupsDirectory, { recursive: true });
  return {
    dataDirectory,
    databaseFile: join(dataDirectory, "soul.sqlite"),
    secretsFile: join(dataDirectory, "secrets.json"),
    backupsDirectory,
  };
}
