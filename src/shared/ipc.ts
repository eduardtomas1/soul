import { z } from "zod";
import {
  assistantConversationSchema,
  assistantMessageSchema,
  assistantSendSchema,
  providerStatusSchema,
} from "./contracts/assistant";
import {
  backupModeSchema,
  backupStatusSchema,
  driveClientInputSchema,
  passphraseInputSchema,
  restoreRequestSchema,
} from "./contracts/backup";
import { idSchema, isoDateSchema } from "./contracts/common";
import {
  accountInputSchema,
  accountSchema,
  budgetSchema,
  categoryInputSchema,
  categorySchema,
  csvImportRequestSchema,
  csvImportResultSchema,
  csvImportRowSchema,
  csvMappingSchema,
  csvPreviewSchema,
  financeOverviewSchema,
  monthTrendSchema,
  positiveCentsSchema,
  projectionSchema,
  recurringRuleInputSchema,
  recurringRuleSchema,
  savingsGoalInputSchema,
  savingsGoalSchema,
  transactionInputSchema,
  transactionQuerySchema,
  transactionSchema,
  transactionSuggestionSchema,
  transferInputSchema,
} from "./contracts/finances";
import {
  habitEntrySchema,
  habitInputSchema,
  habitOverviewSchema,
  habitSchema,
  habitStatsSchema,
  medalSchema,
} from "./contracts/habits";
import { dayLogSchema, daySummarySchema, journalEntrySchema, journalInputSchema } from "./contracts/journal";
import { measureEntryInputSchema, measureEntrySchema, measureInputSchema, measureSchema, measuresOverviewSchema } from "./contracts/measures";
import {
  routineDaySchema,
  routineHistoryDaySchema,
  routineInputSchema,
  routineSchema,
} from "./contracts/routines";
import { settingsPatchSchema, settingsSchema } from "./contracts/settings";
import { todaySchema } from "./contracts/today";
import { IPC_CHANNEL_NAMES, IPC_EVENT_NAMES, type IpcChannelName, type IpcEventName } from "./ipc-names";

const nothing = z.void();
const byId = z.object({ id: idSchema });
const byDate = z.object({ date: isoDateSchema });
const dateRange = z.object({ from: isoDateSchema, to: isoDateSchema });
const archiveToggle = z.object({ id: idSchema, archived: z.boolean() });
const orderedIds = z.object({ ids: z.array(idSchema).max(500) });

function channel<Input extends z.ZodType, Output extends z.ZodType>(input: Input, output: Output) {
  return { input, output };
}

export const ipcChannels = {
  "app.info": channel(nothing, z.object({ version: z.string(), dataDirectory: z.string(), platform: z.string() })),
  "app.openExternal": channel(z.object({ url: z.string().url() }), nothing),
  "app.revealDataDirectory": channel(nothing, nothing),

  "settings.get": channel(nothing, settingsSchema),
  "settings.update": channel(settingsPatchSchema, settingsSchema),

  "today.get": channel(byDate, todaySchema),

  "routines.list": channel(nothing, z.array(routineSchema)),
  "routines.create": channel(routineInputSchema, routineSchema),
  "routines.update": channel(z.object({ id: idSchema, input: routineInputSchema }), routineSchema),
  "routines.archive": channel(z.object({ id: idSchema, archived: z.boolean() }), routineSchema),
  "routines.delete": channel(byId, nothing),
  "routines.reorder": channel(orderedIds, nothing),
  "routines.day": channel(byDate, z.array(routineDaySchema)),
  "routines.setStep": channel(
    z.object({ routineId: idSchema, stepId: idSchema, date: isoDateSchema, completed: z.boolean() }),
    z.object({ day: routineDaySchema, newMedals: z.array(medalSchema) }),
  ),
  "routines.history": channel(z.object({ routineId: idSchema, from: isoDateSchema, to: isoDateSchema }), z.array(routineHistoryDaySchema)),

  "habits.overview": channel(dateRange, habitOverviewSchema),
  "habits.create": channel(habitInputSchema, habitSchema),
  "habits.update": channel(z.object({ id: idSchema, input: habitInputSchema }), habitSchema),
  "habits.archive": channel(z.object({ id: idSchema, archived: z.boolean() }), habitSchema),
  "habits.delete": channel(byId, nothing),
  "habits.reorder": channel(orderedIds, nothing),
  "habits.setEntry": channel(
    habitEntrySchema,
    z.object({ entry: habitEntrySchema, stats: habitStatsSchema, newMedals: z.array(medalSchema) }),
  ),
  "medals.list": channel(nothing, z.array(medalSchema)),

  "journal.day": channel(byDate, dayLogSchema),
  "journal.range": channel(dateRange, z.array(daySummarySchema)),
  "journal.save": channel(journalInputSchema, journalEntrySchema.nullable()),
  "journal.search": channel(z.object({ text: z.string().trim().min(1).max(120) }), z.array(journalEntrySchema)),

  "measures.overview": channel(dateRange, measuresOverviewSchema),
  "measures.create": channel(measureInputSchema, measureSchema),
  "measures.update": channel(z.object({ id: idSchema, input: measureInputSchema }), measureSchema),
  "measures.archive": channel(archiveToggle, measureSchema),
  "measures.delete": channel(byId, nothing),
  "measures.setEntry": channel(measureEntryInputSchema, measureEntrySchema.nullable()),

  "finances.overview": channel(nothing, financeOverviewSchema),
  "finances.transactions.list": channel(transactionQuerySchema, z.array(transactionSchema)),
  "finances.transactions.suggestions": channel(nothing, z.array(transactionSuggestionSchema)),
  "finances.transactions.create": channel(transactionInputSchema, transactionSchema),
  "finances.transactions.update": channel(z.object({ id: idSchema, input: transactionInputSchema }), transactionSchema),
  "finances.transactions.delete": channel(byId, nothing),
  "finances.transfers.create": channel(transferInputSchema, z.array(transactionSchema)),
  "finances.accounts.create": channel(accountInputSchema, accountSchema),
  "finances.accounts.update": channel(z.object({ id: idSchema, input: accountInputSchema }), accountSchema),
  "finances.accounts.archive": channel(z.object({ id: idSchema, archived: z.boolean() }), accountSchema),
  "finances.accounts.delete": channel(byId, nothing),
  "finances.categories.create": channel(categoryInputSchema, categorySchema),
  "finances.categories.update": channel(z.object({ id: idSchema, input: categoryInputSchema }), categorySchema),
  "finances.categories.archive": channel(z.object({ id: idSchema, archived: z.boolean() }), categorySchema),
  "finances.categories.delete": channel(byId, nothing),
  "finances.budgets.set": channel(z.object({ categoryId: idSchema, monthlyLimitCents: positiveCentsSchema.nullable() }), z.array(budgetSchema)),
  "finances.recurring.create": channel(recurringRuleInputSchema, recurringRuleSchema),
  "finances.recurring.update": channel(z.object({ id: idSchema, input: recurringRuleInputSchema }), recurringRuleSchema),
  "finances.recurring.delete": channel(byId, nothing),
  "finances.recurring.postDue": channel(nothing, z.object({ posted: z.number().int() })),
  "finances.recurring.skipDue": channel(nothing, z.object({ skipped: z.number().int() })),
  "finances.goals.create": channel(savingsGoalInputSchema, savingsGoalSchema),
  "finances.goals.update": channel(z.object({ id: idSchema, input: savingsGoalInputSchema }), savingsGoalSchema),
  "finances.goals.delete": channel(byId, nothing),
  "finances.goals.contribute": channel(
    z.object({ id: idSchema, amountCents: z.number().int().min(-1_000_000_000_00).max(1_000_000_000_00) }),
    z.object({ goal: savingsGoalSchema, newMedals: z.array(medalSchema) }),
  ),
  "finances.projection": channel(z.object({ months: z.number().int().min(1).max(36) }), projectionSchema),
  "finances.trends": channel(z.object({ months: z.number().int().min(1).max(36) }), z.array(monthTrendSchema)),
  "finances.csv.pick": channel(nothing, z.string().nullable()),
  "finances.csv.preview": channel(z.object({ filePath: z.string().min(1) }), csvPreviewSchema),
  "finances.csv.dryRun": channel(csvImportRequestSchema, z.array(csvImportRowSchema)),
  "finances.csv.import": channel(csvImportRequestSchema, csvImportResultSchema),

  "assistant.providers": channel(z.object({ refresh: z.boolean() }), z.array(providerStatusSchema)),
  "assistant.conversations": channel(nothing, z.array(assistantConversationSchema)),
  "assistant.messages": channel(z.object({ conversationId: idSchema }), z.array(assistantMessageSchema)),
  "assistant.send": channel(assistantSendSchema, z.object({ runId: idSchema, conversationId: idSchema })),
  "assistant.cancel": channel(z.object({ runId: idSchema }), nothing),
  "assistant.deleteConversation": channel(z.object({ conversationId: idSchema }), nothing),

  "backup.status": channel(nothing, backupStatusSchema),
  "backup.setPassphrase": channel(passphraseInputSchema, backupStatusSchema),
  "backup.setMode": channel(z.object({ mode: backupModeSchema }), backupStatusSchema),
  "backup.exportToFile": channel(nothing, z.object({ path: z.string() }).nullable()),
  "backup.pickRestoreFile": channel(nothing, z.string().nullable()),
  "backup.inspectFile": channel(z.object({ filePath: z.string().min(1) }), z.object({ encrypted: z.boolean(), createdAt: z.string().nullable(), appVersion: z.string().nullable() })),
  "backup.restore": channel(restoreRequestSchema, nothing),
  "backup.drive.setClient": channel(driveClientInputSchema.nullable(), backupStatusSchema),
  "backup.drive.connect": channel(nothing, backupStatusSchema),
  "backup.drive.cancelConnect": channel(nothing, nothing),
  "backup.drive.disconnect": channel(nothing, backupStatusSchema),
  "backup.drive.uploadNow": channel(nothing, backupStatusSchema),
} as const;

export type IpcChannels = typeof ipcChannels;
export type IpcChannel = keyof IpcChannels;
export type IpcInput<C extends IpcChannel> = z.input<IpcChannels[C]["input"]>;
export type IpcOutput<C extends IpcChannel> = z.output<IpcChannels[C]["output"]>;

type ChannelsMissingFromNames = Exclude<IpcChannel, IpcChannelName>;
type NamesWithoutChannel = Exclude<IpcChannelName, IpcChannel>;
const channelNamesCoverEveryChannel: ChannelsMissingFromNames extends never ? true : never = true;
const everyNameHasAChannel: NamesWithoutChannel extends never ? true : never = true;
void channelNamesCoverEveryChannel;
void everyNameHasAChannel;

export { IPC_CHANNEL_NAMES, IPC_EVENT_NAMES };
export type IpcEvent = IpcEventName;

export const dataScopeSchema = z.enum(["routines", "habits", "journal", "measures", "finances", "settings", "assistant", "backup", "all"]);
export type DataScope = z.infer<typeof dataScopeSchema>;

export const reminderFiredSchema = z.object({
  kind: z.enum(["routine", "habit"]),
  targetId: idSchema,
  name: z.string(),
});
export type ReminderFired = z.infer<typeof reminderFiredSchema>;

export const csvMappingWithFileSchema = z.object({ filePath: z.string().min(1), mapping: csvMappingSchema });
