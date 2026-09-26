import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from "@shared/contracts/settings";
import { invoke, subscribe } from "./bridge";

interface SettingsContextValue {
  readonly settings: Settings;
  readonly update: (patch: SettingsPatch) => Promise<void>;
  readonly ready: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({ settings: DEFAULT_SETTINGS, update: async () => undefined, ready: false });

function applyDocumentTheme(settings: Settings, systemDark: boolean): void {
  const dark = settings.theme === "dark" || (settings.theme === "system" && systemDark);
  document.documentElement.dataset.theme = settings.theme === "natural" ? "natural" : dark ? "dark" : "light";
  document.documentElement.dataset.motion = settings.reduceMotion === "always" ? "reduced" : "system";
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    invoke("settings.get")
      .then(setSettings)
      .catch(() => undefined)
      .finally(() => setReady(true));
    return subscribe<{ scope: string }>("data.changed", ({ scope }) => {
      if (scope === "settings" || scope === "all") invoke("settings.get").then(setSettings).catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    applyDocumentTheme(settings, systemDark);
  }, [settings, systemDark]);

  const update = useCallback(async (patch: SettingsPatch) => {
    const next = await invoke("settings.update", patch);
    setSettings(next);
  }, []);

  const value = useMemo(() => ({ settings, update, ready }), [settings, update, ready]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
