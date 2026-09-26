import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { IsoDate } from "@shared/contracts/common";
import { todayIso } from "@shared/dates";

const ClockContext = createContext<IsoDate | null>(null);

function millisecondsUntilTomorrow(now: Date): number {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return tomorrow.getTime() - now.getTime();
}

export function ClockProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState<IsoDate>(() => todayIso());

  useEffect(() => {
    let timer = 0;
    const refresh = () => setToday(todayIso());
    const schedule = () => {
      timer = window.setTimeout(() => {
        refresh();
        schedule();
      }, millisecondsUntilTomorrow(new Date()));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    schedule();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return <ClockContext.Provider value={today}>{children}</ClockContext.Provider>;
}

export function useToday(): IsoDate {
  return useContext(ClockContext) ?? todayIso();
}

export function usePickedDay(initial: string | undefined): [IsoDate, (date: IsoDate) => void] {
  const today = useToday();
  const [picked, setPicked] = useState<IsoDate | null>(() => (initial && /^\d{4}-\d{2}-\d{2}$/u.test(initial) && initial < today ? initial : null));
  const date = picked !== null && picked < today ? picked : today;
  const choose = useCallback((next: IsoDate) => setPicked(next >= today ? null : next), [today]);
  return [date, choose];
}
