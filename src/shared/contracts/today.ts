import { z } from "zod";
import { isoDateSchema } from "./common";
import { projectionItemSchema, centsSchema } from "./finances";
import { habitEntrySchema, habitSchema, habitStatsSchema, medalSchema } from "./habits";
import { dayLogSchema, daySummarySchema } from "./journal";
import { measureEntrySchema, measureSchema } from "./measures";
import { routineDaySchema, routineSchema } from "./routines";

export const todaySchema = z.object({
  date: isoDateSchema,
  routines: z.array(routineSchema),
  routineDays: z.array(routineDaySchema),
  habits: z.array(habitSchema),
  habitEntries: z.array(habitEntrySchema),
  habitStats: z.array(habitStatsSchema),
  measures: z.array(measureSchema),
  measureEntries: z.array(measureEntrySchema),
  log: dayLogSchema,
  days: z.array(daySummarySchema),
  upcoming: z.array(projectionItemSchema),
  netWorthCents: centsSchema,
  monthExpenseCents: centsSchema,
  lastMonthToDateExpenseCents: centsSchema,
  recentMedals: z.array(medalSchema),
});
export type Today = z.infer<typeof todaySchema>;
