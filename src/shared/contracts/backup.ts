import { z } from "zod";
import { isoTimestampSchema } from "./common";

export const backupModeSchema = z.enum(["off", "daily", "on-change"]);
export type BackupMode = z.infer<typeof backupModeSchema>;

export const backupStatusSchema = z.object({
  passphraseSet: z.boolean(),
  mode: backupModeSchema,
  drive: z.object({
    clientConfigured: z.boolean(),
    connected: z.boolean(),
    accountEmail: z.string().nullable(),
    fileName: z.string(),
    lastUploadAt: isoTimestampSchema.nullable(),
    lastError: z.string().nullable(),
  }),
  lastLocalExportAt: isoTimestampSchema.nullable(),
  busy: z.boolean(),
});
export type BackupStatus = z.infer<typeof backupStatusSchema>;

export const driveClientInputSchema = z.object({
  clientId: z.string().trim().min(10).max(300),
  clientSecret: z.string().trim().min(5).max(300),
});
export type DriveClientInput = z.infer<typeof driveClientInputSchema>;

export const passphraseInputSchema = z.object({
  passphrase: z.string().min(8).max(256).nullable(),
});

export const restoreRequestSchema = z.object({
  source: z.enum(["file", "drive"]),
  filePath: z.string().optional(),
  passphrase: z.string().max(256).optional(),
});
export type RestoreRequest = z.infer<typeof restoreRequestSchema>;

export const backupEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("progress"), label: z.string() }),
  z.object({ kind: z.literal("uploaded"), at: isoTimestampSchema }),
  z.object({ kind: z.literal("failed"), message: z.string() }),
  z.object({ kind: z.literal("restored") }),
]);
export type BackupEvent = z.infer<typeof backupEventSchema>;
