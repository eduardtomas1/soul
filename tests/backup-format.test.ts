import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeBackup, encodeBackup, readBackupHeader } from "../src/main/backup/format";

function sampleDatabase(): Buffer {
  const directory = mkdtempSync(join(tmpdir(), "soul-test-"));
  const file = join(directory, "sample.sqlite");
  const database = new Database(file);
  database.exec("CREATE TABLE notes (body TEXT); INSERT INTO notes VALUES ('hello');");
  database.close();
  const bytes = readFileSync(file);
  rmSync(directory, { recursive: true, force: true });
  return bytes;
}

describe("backup format", () => {
  it("round-trips an unencrypted snapshot", () => {
    const database = sampleDatabase();
    const encoded = encodeBackup({ database, appVersion: "0.1.0", schemaVersion: 1, passphrase: null });
    const { header } = readBackupHeader(encoded);
    expect(header.encrypted).toBe(false);
    expect(decodeBackup(encoded, null).database.equals(database)).toBe(true);
  });

  it("round-trips an encrypted snapshot and rejects a wrong passphrase", () => {
    const database = sampleDatabase();
    const encoded = encodeBackup({ database, appVersion: "0.1.0", schemaVersion: 1, passphrase: "correct horse" });
    expect(readBackupHeader(encoded).header.encrypted).toBe(true);
    expect(decodeBackup(encoded, "correct horse").database.equals(database)).toBe(true);
    expect(() => decodeBackup(encoded, "wrong")).toThrow(/passphrase/u);
    expect(() => decodeBackup(encoded, null)).toThrow(/encrypted/u);
  });

  it("refuses files that are not backups", () => {
    expect(() => readBackupHeader(Buffer.from("not a backup\nreally"))).toThrow(/not a Soul backup/u);
  });
});
