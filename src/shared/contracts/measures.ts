import { z } from "zod";
import {
  colorTokenSchema,
  iconKeySchema,
  idSchema,
  isoDateSchema,
  isoTimestampSchema,
  nameSchema,
  sortOrderSchema,
} from "./common";

export const measureValueSchema = z.number().finite().min(-1_000_000_000).max(1_000_000_000);

export const measureDirectionSchema = z.enum(["up", "down", "none"]);
export type MeasureDirection = z.infer<typeof measureDirectionSchema>;

export const measureSchema = z.object({
  id: idSchema,
  name: nameSchema,
  unit: z.string().trim().max(24).nullable(),
  icon: iconKeySchema,
  color: colorTokenSchema,
  decimals: z.number().int().min(0).max(3),
  target: measureValueSchema.nullable(),
  direction: measureDirectionSchema,
  sortOrder: sortOrderSchema,
  archivedAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
});
export type Measure = z.infer<typeof measureSchema>;

export const measureInputSchema = measureSchema.pick({
  name: true,
  unit: true,
  icon: true,
  color: true,
  decimals: true,
  target: true,
  direction: true,
});
export type MeasureInput = z.infer<typeof measureInputSchema>;

export const measureEntrySchema = z.object({
  measureId: idSchema,
  date: isoDateSchema,
  value: measureValueSchema,
});
export type MeasureEntry = z.infer<typeof measureEntrySchema>;

export const measureEntryInputSchema = measureEntrySchema.extend({ value: measureValueSchema.nullable() });
export type MeasureEntryInput = z.infer<typeof measureEntryInputSchema>;

export const measuresOverviewSchema = z.object({
  measures: z.array(measureSchema),
  entries: z.array(measureEntrySchema),
});
export type MeasuresOverview = z.infer<typeof measuresOverviewSchema>;
