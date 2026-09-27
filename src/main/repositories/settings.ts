import type { SoulDatabase } from "../database/open";
import { DEFAULT_SETTINGS, settingsSchema, type Settings, type SettingsPatch } from "@shared/contracts/settings";

export interface SettingsRepository {
  readonly get: () => Settings;
  readonly update: (patch: SettingsPatch) => Settings;
  readonly getRaw: (key: string) => string | null;
  readonly setRaw: (key: string, value: string | null) => void;
}

const SETTINGS_KEY = "settings";

function renameRetiredTheme(stored: unknown): unknown {
  return typeof stored === "object" && stored !== null && "theme" in stored && stored.theme === "natural" ? { ...stored, theme: "slate" } : stored;
}

export function createSettingsRepository(database: SoulDatabase): SettingsRepository {
  const select = database.prepare<[string], { value: string }>("SELECT value FROM settings WHERE key = ?");
  const upsert = database.prepare<[string, string]>(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  const remove = database.prepare<[string]>("DELETE FROM settings WHERE key = ?");

  function get(): Settings {
    const row = select.get(SETTINGS_KEY);
    if (!row) return DEFAULT_SETTINGS;
    const parsed = settingsSchema.partial().safeParse(renameRetiredTheme(JSON.parse(row.value)));
    if (!parsed.success) return DEFAULT_SETTINGS;
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const [key, value] of Object.entries(parsed.data)) if (value !== undefined) merged[key] = value;
    return settingsSchema.parse(merged);
  }

  return {
    get,
    update(patch) {
      const next = settingsSchema.parse({ ...get(), ...patch });
      upsert.run(SETTINGS_KEY, JSON.stringify(next));
      return next;
    },
    getRaw(key) {
      return select.get(key)?.value ?? null;
    },
    setRaw(key, value) {
      if (value === null) remove.run(key);
      else upsert.run(key, value);
    },
  };
}
