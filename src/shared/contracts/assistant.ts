import { z } from "zod";
import { idSchema, isoTimestampSchema } from "./common";

export const providerIdSchema = z.enum(["claude", "codex"]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const providerStatusSchema = z.object({
  id: providerIdSchema,
  name: z.string(),
  installed: z.boolean(),
  version: z.string().nullable(),
  executable: z.string().nullable(),
  detail: z.string().nullable(),
});
export type ProviderStatus = z.infer<typeof providerStatusSchema>;

export const assistantRoleSchema = z.enum(["user", "assistant"]);

export const assistantMessageSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  role: assistantRoleSchema,
  content: z.string(),
  createdAt: isoTimestampSchema,
});
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

export const assistantConversationSchema = z.object({
  id: idSchema,
  title: z.string(),
  provider: providerIdSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type AssistantConversation = z.infer<typeof assistantConversationSchema>;

export const assistantSendSchema = z.object({
  conversationId: idSchema.nullable(),
  provider: providerIdSchema,
  prompt: z.string().trim().min(1).max(20_000),
});
export type AssistantSend = z.infer<typeof assistantSendSchema>;

export const assistantEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("started"), runId: idSchema, conversationId: idSchema, userMessage: assistantMessageSchema }),
  z.object({ kind: z.literal("delta"), runId: idSchema, text: z.string() }),
  z.object({ kind: z.literal("activity"), runId: idSchema, label: z.string() }),
  z.object({ kind: z.literal("completed"), runId: idSchema, message: assistantMessageSchema }),
  z.object({ kind: z.literal("failed"), runId: idSchema, message: z.string() }),
  z.object({ kind: z.literal("cancelled"), runId: idSchema }),
]);
export type AssistantEvent = z.infer<typeof assistantEventSchema>;
