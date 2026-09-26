import { useCallback, useEffect, useState } from "react";
import type { ReminderFired } from "@shared/ipc";
import { subscribe } from "./lib/bridge";
import { ClockProvider } from "./lib/clock";
import { NavigationProvider, useNavigation } from "./lib/navigation";
import { SettingsProvider, useSettings } from "./lib/settings";
import { ToastProvider } from "./lib/toasts";
import { ToastViewport } from "./components/toasts";
import { CommandPalette } from "./features/shell/command-palette";
import { Sidebar } from "./features/shell/sidebar";
import { QuickLog } from "./features/log/quick-log";
import { QuickLogContext, type QuickLogOptions } from "./features/log/quick-log-context";
import { TodayView } from "./features/today/today-view";
import { JournalView } from "./features/journal/journal-view";
import { RoutinesView } from "./features/routines/routines-view";
import { HabitsView } from "./features/habits/habits-view";
import { MeasuresView } from "./features/measures/measures-view";
import { FinancesView } from "./features/finances/finances-view";
import { AssistantView } from "./features/assistant/assistant-view";
import { SettingsView } from "./features/settings/settings-view";

export function App() {
  return (
    <SettingsProvider>
      <NavigationProvider>
        <ToastProvider>
          <ClockProvider>
            <Shell />
          </ClockProvider>
          <ToastViewport />
        </ToastProvider>
      </NavigationProvider>
    </SettingsProvider>
  );
}

function Shell() {
  const { route, navigate } = useNavigation();
  const { ready } = useSettings();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickLog, setQuickLog] = useState<QuickLogOptions | null>(null);
  const openQuickLog = useCallback((options: QuickLogOptions = {}) => {
    setPaletteOpen(false);
    setQuickLog(options);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setQuickLog(null);
        setPaletteOpen((open) => !open);
      } else if (key === "l") {
        event.preventDefault();
        setPaletteOpen(false);
        setQuickLog((open) => (open ? null : {}));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => subscribe<ReminderFired>("reminder.fired", (payload) => {
    navigate({ view: payload.kind === "routine" ? "routines" : "habits", focusId: payload.targetId });
  }), [navigate]);

  if (!ready) return <div className="h-full w-full bg-bg" />;

  return (
    <QuickLogContext.Provider value={openQuickLog}>
      <div className="flex h-full w-full bg-bg text-text">
        <Sidebar onOpenPalette={() => setPaletteOpen(true)} onQuickLog={() => openQuickLog()} />
        <main className="relative h-full min-w-0 flex-1 overflow-hidden">
          <div key={`${route.view}:${route.tab ?? ""}:${route.focusId ?? ""}`} className="fade h-full overflow-y-auto">
            {route.view === "today" && <TodayView />}
            {route.view === "journal" && <JournalView />}
            {route.view === "routines" && <RoutinesView />}
            {route.view === "habits" && <HabitsView />}
            {route.view === "measures" && <MeasuresView />}
            {route.view === "finances" && <FinancesView />}
            {route.view === "assistant" && <AssistantView />}
            {route.view === "settings" && <SettingsView />}
          </div>
        </main>
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onQuickLog={openQuickLog} />}
        {quickLog && <QuickLog initial={quickLog} onClose={() => setQuickLog(null)} />}
      </div>
    </QuickLogContext.Provider>
  );
}
