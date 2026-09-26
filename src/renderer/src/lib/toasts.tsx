import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { Medal } from "@shared/contracts/habits";

export interface Toast {
  readonly id: number;
  readonly title: string;
  readonly description?: string | undefined;
  readonly tone?: "neutral" | "success" | "danger" | undefined;
  readonly medal?: Medal | undefined;
}

interface ToastContextValue {
  readonly toasts: readonly Toast[];
  readonly push: (toast: Omit<Toast, "id">) => void;
  readonly celebrate: (medals: readonly Medal[]) => void;
  readonly dismiss: (id: number) => void;
}

export const TOAST_DURATION = { default: 4_200, medal: 6_500 } as const;

const ToastContext = createContext<ToastContextValue>({ toasts: [], push: () => undefined, celebrate: () => undefined, dismiss: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++counter.current;
    setToasts((current) => [...current.slice(-3), { ...toast, id }]);
    window.setTimeout(() => dismiss(id), toast.medal ? TOAST_DURATION.medal : TOAST_DURATION.default);
  }, [dismiss]);

  const celebrate = useCallback((medals: readonly Medal[]) => {
    medals.forEach((medal, index) => {
      window.setTimeout(() => push({ title: "New milestone", medal }), index * 400);
    });
  }, [push]);

  const value = useMemo(() => ({ toasts, push, celebrate, dismiss }), [toasts, push, celebrate, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts(): ToastContextValue {
  return useContext(ToastContext);
}
