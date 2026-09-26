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

export const habitKindSchema = z.enum(["check", "count"]);
export const habitCadenceSchema = z.enum(["daily", "weekly"]);

export const habitSchema = z.object({
  id: idSchema,
  name: nameSchema,
  icon: iconKeySchema,
  color: colorTokenSchema,
  kind: habitKindSchema,
  targetCount: z.number().int().min(1).max(10_000),
  unit: z.string().trim().max(24).nullable(),
  cadence: habitCadenceSchema,
  weekdays: weekdaysSchema,
  remindAt: clockTimeSchema.nullable(),
  sortOrder: sortOrderSchema,
  archivedAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
});
export type Habit = z.infer<typeof habitSchema>;

export const habitInputSchema = habitSchema.pick({
  name: true,
  icon: true,
  color: true,
  kind: true,
  targetCount: true,
  unit: true,
  cadence: true,
  weekdays: true,
  remindAt: true,
});
export type HabitInput = z.infer<typeof habitInputSchema>;

export const habitEntrySchema = z.object({
  habitId: idSchema,
  date: isoDateSchema,
  count: z.number().int().min(0).max(100_000),
});
export type HabitEntry = z.infer<typeof habitEntrySchema>;

export const habitStatsSchema = z.object({
  habitId: idSchema,
  currentStreak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
  completedLast30: z.number().int().min(0),
  scheduledLast30: z.number().int().min(0),
  totalCompleted: z.number().int().min(0),
});
export type HabitStats = z.infer<typeof habitStatsSchema>;

export const medalKindSchema = z.enum([
  "first-step",
  "streak-7",
  "streak-30",
  "streak-100",
  "streak-365",
  "perfect-week",
  "perfect-month",
  "routine-week",
  "routine-month",
  "saver",
  "budget-keeper",
]);
export type MedalKind = z.infer<typeof medalKindSchema>;

export const medalSubjectKindSchema = z.enum(["habit", "routine", "global"]);

export const medalSchema = z.object({
  id: idSchema,
  kind: medalKindSchema,
  subjectKind: medalSubjectKindSchema,
  subjectId: z.string(),
  subjectName: z.string().nullable(),
  earnedAt: isoTimestampSchema,
});
export type Medal = z.infer<typeof medalSchema>;

export const habitOverviewSchema = z.object({
  habits: z.array(habitSchema),
  entries: z.array(habitEntrySchema),
  stats: z.array(habitStatsSchema),
  medals: z.array(medalSchema),
});
export type HabitOverview = z.infer<typeof habitOverviewSchema>;
