import Database from "better-sqlite3";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { decodeBackup, encodeBackup } from "../src/main/backup/format";
import { snapshotDatabase } from "../src/main/backup/snapshot";
import { CURRENT_SCHEMA_VERSION } from "../src/main/database/migrations";
import { checkIntegrity, openDatabase } from "../src/main/database/open";
import { createFinancesRepository } from "../src/main/repositories/finances";

const directories: string[] = [];

function scratch(): string {
  const directory = mkdtempSync(join(tmpdir(), "soul backup's test "));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("backup snapshot", () => {
  it("round-trips a live database through an encrypted backup", () => {
    const directory = scratch();
    const database = openDatabase(join(directory, "soul.sqlite"));
    const finances = createFinancesRepository(database);
    const account = finances.accounts.create({ name: "Checking", kind: "checking", icon: "bank", color: "sky", openingBalanceCents: 1_000 });
    finances.transactions.create({ accountId: account.id, categoryId: null, amountCents: -250, occurredOn: "2026-03-04", note: "Coffee" });

    const snapshot = snapshotDatabase(database, directory);
    database.close();
    expect(readdirSync(directory).filter((name) => name.startsWith("snapshot-"))).toEqual([]);

    const encoded = encodeBackup({ database: snapshot, appVersion: "0.1.0", schemaVersion: CURRENT_SCHEMA_VERSION, passphrase: "a long passphrase" });
    const restoredFile = join(directory, "restored.sqlite");
    writeFileSync(restoredFile, decodeBackup(encoded, "a long passphrase").database);

    const restored = openDatabase(restoredFile);
    expect(checkIntegrity(restored)).toBe(true);
    expect(createFinancesRepository(restored).accounts.list()[0]?.balanceCents).toBe(750);
    restored.close();
  });

  it("refuses to open data from a newer schema", () => {
    const directory = scratch();
    const file = join(directory, "future.sqlite");
    const future = new Database(file);
    future.pragma(`user_version = ${CURRENT_SCHEMA_VERSION + 1}`);
    future.close();
    expect(() => openDatabase(file)).toThrow(/newer version of Soul/u);
  });
});
