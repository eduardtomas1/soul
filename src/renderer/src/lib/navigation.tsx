import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type View = "today" | "journal" | "routines" | "habits" | "measures" | "finances" | "assistant" | "settings";

export interface Route {
  readonly view: View;
  readonly tab?: string;
  readonly focusId?: string;
}

interface Navigation {
  readonly route: Route;
  readonly navigate: (route: Route) => void;
}

const NavigationContext = createContext<Navigation>({ route: { view: "today" }, navigate: () => undefined });

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>({ view: "today" });
  const navigate = useCallback((next: Route) => setRoute(next), []);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: View; tab?: string | null; focusId?: string | null }>).detail;
      if (!detail?.view) return;
      setRoute({ view: detail.view, ...(detail.tab ? { tab: detail.tab } : {}), ...(detail.focusId ? { focusId: detail.focusId } : {}) });
    };
    window.addEventListener("soul:navigate", handler);
    return () => window.removeEventListener("soul:navigate", handler);
  }, []);
  const value = useMemo(() => ({ route, navigate }), [route, navigate]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): Navigation {
  return useContext(NavigationContext);
}
