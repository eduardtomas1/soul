import type { Account, Category, RecurringRule, SavingsGoal, Transaction } from "@shared/contracts/finances";

export interface AccountRow {
  id: string;
  name: string;
  kind: string;
  icon: string;
  color: string;
  opening_balance_cents: number;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  balance_cents: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  kind: string;
  icon: string;
  color: string;
  sort_order: number;
  archived_at: string | null;
}

export interface TransactionRow {
  id: string;
  account_id: string;
  category_id: string | null;
  amount_cents: number;
  occurred_on: string;
  note: string;
  recurring_rule_id: string | null;
  transfer_group_id: string | null;
  created_at: string;
}

export interface RuleRow {
  id: string;
  name: string;
  account_id: string;
  category_id: string | null;
  amount_cents: number;
  frequency: string;
  interval: number;
  anchor_date: string;
  end_date: string | null;
  next_due_on: string;
  auto_post: number;
  created_at: string;
}

export interface GoalRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  target_cents: number;
  saved_cents: number;
  target_date: string | null;
  sort_order: number;
  achieved_at: string | null;
  created_at: string;
}

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as Account["kind"],
    icon: row.icon,
    color: row.color as Account["color"],
    openingBalanceCents: row.opening_balance_cents,
    balanceCents: row.balance_cents,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as Category["kind"],
    icon: row.icon,
    color: row.color as Category["color"],
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
  };
}

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    amountCents: row.amount_cents,
    occurredOn: row.occurred_on,
    note: row.note,
    recurringRuleId: row.recurring_rule_id,
    transferGroupId: row.transfer_group_id,
    createdAt: row.created_at,
  };
}

export function toRule(row: RuleRow): RecurringRule {
  return {
    id: row.id,
    name: row.name,
    accountId: row.account_id,
    categoryId: row.category_id,
    amountCents: row.amount_cents,
    frequency: row.frequency as RecurringRule["frequency"],
    interval: row.interval,
    anchorDate: row.anchor_date,
    endDate: row.end_date,
    nextDueOn: row.next_due_on,
    autoPost: row.auto_post === 1,
    createdAt: row.created_at,
  };
}

export function toGoal(row: GoalRow): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color as SavingsGoal["color"],
    targetCents: row.target_cents,
    savedCents: row.saved_cents,
    targetDate: row.target_date,
    sortOrder: row.sort_order,
    achievedAt: row.achieved_at,
    createdAt: row.created_at,
  };
}
