import { createContext, useContext } from "react";
import type { IsoDate } from "@shared/contracts/common";

export type LogMode = "expense" | "income" | "habits" | "routines" | "measures" | "journal";

export interface QuickLogOptions {
  readonly mode?: LogMode;
  readonly date?: IsoDate;
}

export const QuickLogContext = createContext<(options?: QuickLogOptions) => void>(() => undefined);

export function useQuickLog(): (options?: QuickLogOptions) => void {
  return useContext(QuickLogContext);
}
