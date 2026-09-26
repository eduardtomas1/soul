import { z } from "zod";
import {
  clockTimeSchema,
  colorTokenSchema,
  iconKeySchema,
  idSchema,
  isoDateSchema,
  isoTimestampSchema,
  nameSchema,
  sortOrderSchema,
  weekdaysSchema,
} from "./common";

export const routineStepSchema = z.object({
  id: idSchema,
  routineId: idSchema,
  name: nameSchema,
  durationMinutes: z.number().int().min(1).max(1_440).nullable(),
  sortOrder: sortOrderSchema,
});
export type RoutineStep = z.infer<typeof routineStepSchema>;

export const routineSchema = z.object({
  id: idSchema,
  name: nameSchema,
  icon: iconKeySchema,
  color: colorTokenSchema,
  timeOfDay: clockTimeSchema.nullable(),
  weekdays: weekdaysSchema,
  remindAt: clockTimeSchema.nullable(),
  sortOrder: sortOrderSchema,
  archivedAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
  steps: z.array(routineStepSchema),
});
export type Routine = z.infer<typeof routineSchema>;

export const routineStepInputSchema = z.object({
  id: idSchema.optional(),
  name: nameSchema,
  durationMinutes: z.number().int().min(1).max(1_440).nullable(),
});
export type RoutineStepInput = z.infer<typeof routineStepInputSchema>;

export const routineInputSchema = z.object({
  name: nameSchema,
  icon: iconKeySchema,
  color: colorTokenSchema,
  timeOfDay: clockTimeSchema.nullable(),
  weekdays: weekdaysSchema.min(1),
  remindAt: clockTimeSchema.nullable(),
  steps: z.array(routineStepInputSchema).min(1).max(40),
});
export type RoutineInput = z.infer<typeof routineInputSchema>;

export const routineDaySchema = z.object({
  routineId: idSchema,
  date: isoDateSchema,
  completedStepIds: z.array(idSchema),
});
export type RoutineDay = z.infer<typeof routineDaySchema>;

export const routineHistoryDaySchema = z.object({
  date: isoDateSchema,
  scheduled: z.boolean(),
  completedSteps: z.number().int().min(0),
  totalSteps: z.number().int().min(0),
});
export type RoutineHistoryDay = z.infer<typeof routineHistoryDaySchema>;
