import { z } from "zod";

export const idSchema = z.string().min(1).max(64);
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
export const isoMonthSchema = z.string().regex(/^\d{4}-\d{2}$/u);
export const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u);
export const isoTimestampSchema = z.string().min(20).max(40);
export const nameSchema = z.string().trim().min(1).max(120);
export const noteSchema = z.string().max(2_000);
export const weekdaySchema = z.number().int().min(0).max(6);
export const weekdaysSchema = z.array(weekdaySchema).max(7);
export const sortOrderSchema = z.number().int().min(0).max(100_000);

export const colorTokenSchema = z.enum([
  "rose",
  "coral",
  "amber",
  "lime",
  "mint",
  "sky",
  "iris",
  "plum",
  "sand",
  "slate",
]);
export type ColorToken = z.infer<typeof colorTokenSchema>;
export const COLOR_TOKENS = colorTokenSchema.options;

export const iconKeySchema = z.string().regex(/^[a-z0-9-]{1,48}$/u);

export type Id = z.infer<typeof idSchema>;
export type IsoDate = z.infer<typeof isoDateSchema>;
export type IsoMonth = z.infer<typeof isoMonthSchema>;
export type ClockTime = z.infer<typeof clockTimeSchema>;
export type Weekday = z.infer<typeof weekdaySchema>;
