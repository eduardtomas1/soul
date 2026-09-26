import { safeStorage } from "electron";
import { readFileSync, writeFileSync, renameSync, existsSync, chmodSync } from "node:fs";

export interface SecretStore {
  readonly get: (key: string) => string | null;
  readonly set: (key: string, value: string | null) => void;
  readonly has: (key: string) => boolean;
}

export function createSecretStore(filePath: string): SecretStore {
  let cache: Record<string, string> = load();

  function load(): Record<string, string> {
    if (!existsSync(filePath)) return {};
    try {
      const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
      if (parsed && typeof parsed === "object") {
        return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, value]) => typeof value === "string")) as Record<string, string>;
      }
    } catch {
      return {};
    }
    return {};
  }

  function persist(): void {
    const temporary = `${filePath}.tmp`;
    writeFileSync(temporary, JSON.stringify(cache), { mode: 0o600 });
    renameSync(temporary, filePath);
    try {
      chmodSync(filePath, 0o600);
    } catch {
      return;
    }
  }

  function encrypt(value: string): string {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("The operating system keychain is not available.");
    return safeStorage.encryptString(value).toString("base64");
  }

  function decrypt(value: string): string | null {
    try {
      return safeStorage.decryptString(Buffer.from(value, "base64"));
    } catch {
      return null;
    }
  }

  return {
    get(key) {
      const stored = cache[key];
      return stored === undefined ? null : decrypt(stored);
    },
    set(key, value) {
      if (value === null) {
        const { [key]: _removed, ...rest } = cache;
        cache = rest;
      } else {
        cache = { ...cache, [key]: encrypt(value) };
      }
      persist();
    },
    has(key) {
      return cache[key] !== undefined;
    },
  };
}
