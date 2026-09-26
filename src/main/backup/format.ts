import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

export const BACKUP_FORMAT = "soul-backup";
export const BACKUP_VERSION = 1;
const SQLITE_MAGIC = "SQLite format 3\u0000";
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 } as const;

export interface BackupHeader {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: number;
  readonly createdAt: string;
  readonly appVersion: string;
  readonly schemaVersion: number;
  readonly encrypted: boolean;
  readonly salt?: string;
  readonly iv?: string;
  readonly tag?: string;
}

export interface EncodeOptions {
  readonly database: Buffer;
  readonly appVersion: string;
  readonly schemaVersion: number;
  readonly passphrase: string | null;
  readonly createdAt?: string;
}

export function isSqliteFile(buffer: Buffer): boolean {
  return buffer.length > 100 && buffer.subarray(0, 16).toString("latin1") === SQLITE_MAGIC;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase.normalize("NFKC"), salt, 32, SCRYPT);
}

export function encodeBackup(options: EncodeOptions): Buffer {
  if (!isSqliteFile(options.database)) throw new Error("The snapshot is not a SQLite database.");
  const compressed = gzipSync(options.database, { level: 6 });
  let payload = compressed;
  const header: BackupHeader = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: options.createdAt ?? new Date().toISOString(),
    appVersion: options.appVersion,
    schemaVersion: options.schemaVersion,
    encrypted: options.passphrase !== null,
  };
  let fullHeader: BackupHeader = header;
  if (options.passphrase !== null) {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", deriveKey(options.passphrase, salt), iv);
    payload = Buffer.concat([cipher.update(compressed), cipher.final()]);
    fullHeader = { ...header, salt: salt.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
  }
  return Buffer.concat([Buffer.from(`${JSON.stringify(fullHeader)}\n`, "utf8"), payload]);
}

export function readBackupHeader(buffer: Buffer): { header: BackupHeader; payload: Buffer } {
  const newline = buffer.indexOf(0x0a);
  if (newline < 0 || newline > 4_096) throw new Error("This is not a Soul backup file.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.subarray(0, newline).toString("utf8"));
  } catch {
    throw new Error("This is not a Soul backup file.");
  }
  if (!parsed || typeof parsed !== "object" || (parsed as { format?: unknown }).format !== BACKUP_FORMAT) {
    throw new Error("This is not a Soul backup file.");
  }
  const header = parsed as BackupHeader;
  if (header.version !== BACKUP_VERSION) throw new Error("This backup was made by a newer version of Soul.");
  return { header, payload: buffer.subarray(newline + 1) };
}

export function decodeBackup(buffer: Buffer, passphrase: string | null): { header: BackupHeader; database: Buffer } {
  const { header, payload } = readBackupHeader(buffer);
  let compressed = payload;
  if (header.encrypted) {
    if (passphrase === null || passphrase.length === 0) throw new Error("This backup is encrypted. Enter its passphrase.");
    if (!header.salt || !header.iv || !header.tag) throw new Error("The backup header is incomplete.");
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(passphrase, Buffer.from(header.salt, "base64")), Buffer.from(header.iv, "base64"));
    decipher.setAuthTag(Buffer.from(header.tag, "base64"));
    try {
      compressed = Buffer.concat([decipher.update(payload), decipher.final()]);
    } catch {
      throw new Error("That passphrase does not open this backup.");
    }
  }
  let database: Buffer;
  try {
    database = gunzipSync(compressed);
  } catch {
    throw new Error("The backup contents are damaged.");
  }
  if (!isSqliteFile(database)) throw new Error("The backup does not contain a Soul database.");
  return { header, database };
}
