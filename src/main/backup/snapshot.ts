import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { SoulDatabase } from "../database/open";

export function snapshotDatabase(database: SoulDatabase, directory: string): Buffer {
  const target = join(directory, `snapshot-${process.pid}-${Date.now()}.sqlite`);
  const escaped = target.replace(/'/gu, "''");
  database.exec(`VACUUM INTO '${escaped}'`);
  try {
    return readFileSync(target);
  } finally {
    rmSync(target, { force: true });
  }
}
