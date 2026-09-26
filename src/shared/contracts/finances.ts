import { z } from "zod";
import {
  colorTokenSchema,
  iconKeySchema,
  idSchema,
  isoDateSchema,
  isoMonthSchema,
  isoTimestampSchema,
  nameSchema,
  noteSchema,
  sortOrderSchema,
} from "./common";

export const centsSchema = z.number().int().min(-1_000_000_000_00).max(1_000_000_000_00);
export const positiveCentsSchema = z.number().int().min(0).max(1_000_000_000_00);

export const accountKindSchema = z.enum(["checking", "savings", "cash", "card", "investment"]);
export type AccountKind = z.infer<typeof accountKindSchema>;

export const accountSchema = z.object({
  id: idSchema,
  name: nameSchema,
  kind: accountKindSchema,
  icon: iconKeySchema,
  color: colorTokenSchema,
  openingBalanceCents: centsSchema,
  balanceCents: centsSchema,
  sortOrder: sortOrderSchema,
  archivedAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
});
export type Account = z.infer<typeof accountSchema>;

export const accountInputSchema = accountSchema.pick({
  name: true,
  kind: true,
  icon: true,
  color: true,
  openingBalanceCents: true,
});
export type AccountInput = z.infer<typeof accountInputSchema>;

export const categoryKindSchema = z.enum(["income", "expense"]);
export type CategoryKind = z.infer<typeof categoryKindSchema>;

export const categorySchema = z.object({
  id: idSchema,
  name: nameSchema,
  kind: categoryKindSchema,
  icon: iconKeySchema,
  color: colorTokenSchema,
  sortOrder: sortOrderSchema,
  archivedAt: isoTimestampSchema.nullable(),
});
export type Category = z.infer<typeof categorySchema>;

export const categoryInputSchema = categorySchema.pick({
  name: true,
  kind: true,
  icon: true,
  color: true,
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const transactionSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  categoryId: idSchema.nullable(),
  amountCents: centsSchema,
  occurredOn: isoDateSchema,
  note: noteSchema,
  recurringRuleId: idSchema.nullable(),
  transferGroupId: idSchema.nullable(),
  createdAt: isoTimestampSchema,
});
export type Transaction = z.infer<typeof transactionSchema>;

export const transactionInputSchema = transactionSchema.pick({
  accountId: true,
  categoryId: true,
  amountCents: true,
  occurredOn: true,
  note: true,
});
export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const transferInputSchema = z.object({
  fromAccountId: idSchema,
  toAccountId: idSchema,
  amountCents: positiveCentsSchema.min(1),
  occurredOn: isoDateSchema,
  note: noteSchema,
});
export type TransferInput = z.infer<typeof transferInputSchema>;

export const transactionQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  accountId: idSchema.optional(),
  categoryId: idSchema.optional(),
  search: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(2_000).default(500),
});
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

export const recurringFrequencySchema = z.enum(["weekly", "monthly", "yearly"]);
export type RecurringFrequency = z.infer<typeof recurringFrequencySchema>;

export const recurringRuleSchema = z.object({
  id: idSchema,
  name: nameSchema,
  accountId: idSchema,
  categoryId: idSchema.nullable(),
  amountCents: centsSchema,
  frequency: recurringFrequencySchema,
  interval: z.number().int().min(1).max(52),
  anchorDate: isoDateSchema,
  endDate: isoDateSchema.nullable(),
  nextDueOn: isoDateSchema,
  autoPost: z.boolean(),
  createdAt: isoTimestampSchema,
});
export type RecurringRule = z.infer<typeof recurringRuleSchema>;

export const recurringRuleInputSchema = recurringRuleSchema.pick({
  name: true,
  accountId: true,
  categoryId: true,
  amountCents: true,
  frequency: true,
  interval: true,
  anchorDate: true,
  endDate: true,
  autoPost: true,
});
export type RecurringRuleInput = z.infer<typeof recurringRuleInputSchema>;

export const budgetSchema = z.object({
  categoryId: idSchema,
  monthlyLimitCents: positiveCentsSchema,
});
export type Budget = z.infer<typeof budgetSchema>;

export const savingsGoalSchema = z.object({
  id: idSchema,
  name: nameSchema,
  icon: iconKeySchema,
  color: colorTokenSchema,
  targetCents: positiveCentsSchema.min(1),
  savedCents: positiveCentsSchema,
  targetDate: isoDateSchema.nullable(),
  sortOrder: sortOrderSchema,
  achievedAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
});
export type SavingsGoal = z.infer<typeof savingsGoalSchema>;

export const savingsGoalInputSchema = savingsGoalSchema.pick({
  name: true,
  icon: true,
  color: true,
  targetCents: true,
  targetDate: true,
});
export type SavingsGoalInput = z.infer<typeof savingsGoalInputSchema>;

export const monthSummarySchema = z.object({
  month: isoMonthSchema,
  incomeCents: positiveCentsSchema,
  expenseCents: positiveCentsSchema,
  netCents: centsSchema,
  byCategory: z.array(z.object({
    categoryId: idSchema.nullable(),
    spentCents: positiveCentsSchema,
    limitCents: positiveCentsSchema.nullable(),
  })),
});
export type MonthSummary = z.infer<typeof monthSummarySchema>;

export const projectionItemSchema = z.object({
  ruleId: idSchema,
  name: nameSchema,
  dueOn: isoDateSchema,
  amountCents: centsSchema,
});
export type ProjectionItem = z.infer<typeof projectionItemSchema>;

export const projectionMonthSchema = z.object({
  month: isoMonthSchema,
  openingCents: centsSchema,
  incomeCents: positiveCentsSchema,
  expenseCents: positiveCentsSchema,
  closingCents: centsSchema,
  items: z.array(projectionItemSchema),
});
export type ProjectionMonth = z.infer<typeof projectionMonthSchema>;

export const projectionSchema = z.object({
  startingCents: centsSchema,
  months: z.array(projectionMonthSchema),
});
export type Projection = z.infer<typeof projectionSchema>;

export const monthTrendSchema = z.object({
  month: isoMonthSchema,
  incomeCents: positiveCentsSchema,
  expenseCents: positiveCentsSchema,
  netCents: centsSchema,
  netWorthCents: centsSchema,
});
export type MonthTrend = z.infer<typeof monthTrendSchema>;

export const transactionSuggestionSchema = z.object({
  note: noteSchema,
  categoryId: idSchema.nullable(),
  accountId: idSchema,
  amountCents: centsSchema,
  uses: z.number().int().min(1),
});
export type TransactionSuggestion = z.infer<typeof transactionSuggestionSchema>;

export const financeOverviewSchema = z.object({
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  budgets: z.array(budgetSchema),
  recurringRules: z.array(recurringRuleSchema),
  savingsGoals: z.array(savingsGoalSchema),
  currentMonth: monthSummarySchema,
  previousMonth: monthSummarySchema,
  previousMonthToDate: z.object({ incomeCents: positiveCentsSchema, expenseCents: positiveCentsSchema }),
  netWorthCents: centsSchema,
});
export type FinanceOverview = z.infer<typeof financeOverviewSchema>;

export const csvColumnRoleSchema = z.enum(["date", "amount", "debit", "credit", "note", "ignore"]);
export type CsvColumnRole = z.infer<typeof csvColumnRoleSchema>;

export const csvPreviewSchema = z.object({
  delimiter: z.string().length(1),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  totalRows: z.number().int().min(0),
  suggestedRoles: z.array(csvColumnRoleSchema),
});
export type CsvPreview = z.infer<typeof csvPreviewSchema>;

export const csvMappingSchema = z.object({
  roles: z.array(csvColumnRoleSchema),
  dateFormat: z.enum(["auto", "dmy", "mdy", "ymd"]),
  hasHeader: z.boolean(),
  invertSign: z.boolean(),
});
export type CsvMapping = z.infer<typeof csvMappingSchema>;

export const csvImportRowSchema = z.object({
  occurredOn: isoDateSchema.nullable(),
  amountCents: centsSchema.nullable(),
  note: z.string(),
  duplicate: z.boolean(),
  error: z.string().nullable(),
});
export type CsvImportRow = z.infer<typeof csvImportRowSchema>;

export const csvImportRequestSchema = z.object({
  filePath: z.string().min(1),
  accountId: idSchema,
  mapping: csvMappingSchema,
  categoryId: idSchema.nullable(),
  skipDuplicates: z.boolean(),
});
export type CsvImportRequest = z.infer<typeof csvImportRequestSchema>;

export const csvImportResultSchema = z.object({
  imported: z.number().int().min(0),
  skipped: z.number().int().min(0),
  failed: z.number().int().min(0),
});
export type CsvImportResult = z.infer<typeof csvImportResultSchema>;
