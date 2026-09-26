import { z } from "zod";
import { colorTokenSchema, iconKeySchema, isoDateSchema, isoTimestampSchema } from "./common";
import { centsSchema, positiveCentsSchema } from "./finances";
import { medalKindSchema } from "./habits";

export const ratingSchema = z.number().int().min(1).max(5);
export type Rating = z.infer<typeof ratingSchema>;

export const journalNoteSchema = z.string().max(20_000);

export const journalEntrySchema = z.object({
  date: isoDateSchema,
  mood: ratingSchema.nullable(),
  energy: ratingSchema.nullable(),
  note: journalNoteSchema,
  updatedAt: isoTimestampSchema,
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;

export const journalInputSchema = z.object({
  date: isoDateSchema,
  mood: ratingSchema.nullable().optional(),
  energy: ratingSchema.nullable().optional(),
  note: journalNoteSchema.optional(),
});
export type JournalInput = z.infer<typeof journalInputSchema>;

export const daySummarySchema = z.object({
  date: isoDateSchema,
  mood: ratingSchema.nullable(),
  energy: ratingSchema.nullable(),
  hasNote: z.boolean(),
  habitsDone: z.number().int().min(0),
  habitsDue: z.number().int().min(0),
  routinesDone: z.number().int().min(0),
  routinesDue: z.number().int().min(0),
  incomeCents: positiveCentsSchema,
  expenseCents: positiveCentsSchema,
  transactions: z.number().int().min(0),
  measures: z.number().int().min(0),
});
export type DaySummary = z.infer<typeof daySummarySchema>;

export const activityKindSchema = z.enum(["routine", "habit", "measure", "transaction", "milestone"]);
export type ActivityKind = z.infer<typeof activityKindSchema>;

export const activityItemSchema = z.object({
  kind: activityKindSchema,
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  icon: iconKeySchema,
  color: colorTokenSchema,
  amountCents: centsSchema.nullable(),
  done: z.boolean().nullable(),
  medalKind: medalKindSchema.nullable(),
});
export type ActivityItem = z.infer<typeof activityItemSchema>;

export const dayLogSchema = z.object({
  date: isoDateSchema,
  entry: journalEntrySchema.nullable(),
  summary: daySummarySchema,
  activity: z.array(activityItemSchema),
});
export type DayLog = z.infer<typeof dayLogSchema>;
