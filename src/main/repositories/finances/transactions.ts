import type { SoulDatabase } from "../../database/open";
import { newId, nowIso } from "../../database/ids";
import { containsPattern } from "../../database/like";
import { foldText } from "@shared/text";
import type { IsoDate } from "@shared/contracts/common";
import type { Transaction, TransactionInput, TransactionQuery, TransactionSuggestion, TransferInput } from "@shared/contracts/finances";
import { toTransaction, type TransactionRow } from "./rows";

const SUGGESTION_SAMPLE = 3_000;
const SUGGESTION_LIMIT = 200;

export interface TransactionLinks {
  readonly recurringRuleId?: string;
  readonly transferGroupId?: string;
}

export interface TransactionsStore {
  readonly list: (query: TransactionQuery) => Transaction[];
  readonly suggestions: () => TransactionSuggestion[];
  readonly create: (input: TransactionInput, links?: TransactionLinks) => Transaction;
  readonly update: (id: string, input: TransactionInput) => Transaction;
  readonly remove: (id: string) => void;
  readonly createTransfer: (input: TransferInput) => Transaction[];
  readonly exists: (accountId: string, occurredOn: IsoDate, amountCents: number, note: string) => boolean;
  readonly insertMany: (rows: readonly TransactionInput[]) => number;
}

export function createTransactionsStore(database: SoulDatabase): TransactionsStore {
  const selectTransaction = database.prepare<[string], TransactionRow>("SELECT * FROM transactions WHERE id = ?");
  const insertTransaction = database.prepare<[string, string, string | null, number, string, string, string | null, string | null, string]>(
    "INSERT INTO transactions (id, account_id, category_id, amount_cents, occurred_on, note, recurring_rule_id, transfer_group_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const updateTransaction = database.prepare<[string, string | null, number, string, string, string]>(
    "UPDATE transactions SET account_id = ?, category_id = ?, amount_cents = ?, occurred_on = ?, note = ? WHERE id = ?",
  );
  const deleteTransaction = database.prepare<[string]>("DELETE FROM transactions WHERE id = ?");
  const deleteTransferGroup = database.prepare<[string]>("DELETE FROM transactions WHERE transfer_group_id = ?");
  const transactionExists = database.prepare<[string, string, number, string], { id: string }>(
    "SELECT id FROM transactions WHERE account_id = ? AND occurred_on = ? AND amount_cents = ? AND note = ? LIMIT 1",
  );
  const recentWithNotes = database.prepare<[number], { note: string; category_id: string | null; account_id: string; amount_cents: number }>(
    "SELECT note, category_id, account_id, amount_cents FROM transactions WHERE TRIM(note) <> '' AND transfer_group_id IS NULL ORDER BY occurred_on DESC, created_at DESC LIMIT ?",
  );

  function suggestions(): TransactionSuggestion[] {
    const byNote = new Map<string, { suggestion: TransactionSuggestion; uses: number }>();
    for (const row of recentWithNotes.all(SUGGESTION_SAMPLE)) {
      const note = row.note.trim();
      const key = note.toLowerCase();
      const existing = byNote.get(key);
      if (existing) existing.uses += 1;
      else byNote.set(key, { suggestion: { note, categoryId: row.category_id, accountId: row.account_id, amountCents: row.amount_cents, uses: 1 }, uses: 1 });
    }
    return [...byNote.values()]
      .sort((a, b) => b.uses - a.uses)
      .slice(0, SUGGESTION_LIMIT)
      .map(({ suggestion, uses }) => ({ ...suggestion, uses }));
  }

  function requireTransaction(id: string): Transaction {
    const row = selectTransaction.get(id);
    if (!row) throw new Error("Transaction not found.");
    return toTransaction(row);
  }

  function create(input: TransactionInput, links: TransactionLinks = {}): Transaction {
    const id = newId();
    insertTransaction.run(id, input.accountId, input.categoryId, input.amountCents, input.occurredOn, input.note, links.recurringRuleId ?? null, links.transferGroupId ?? null, nowIso());
    return requireTransaction(id);
  }

  function list(query: TransactionQuery): Transaction[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (query.from) {
      clauses.push("occurred_on >= ?");
      params.push(query.from);
    }
    if (query.to) {
      clauses.push("occurred_on <= ?");
      params.push(query.to);
    }
    if (query.accountId) {
      clauses.push("account_id = ?");
      params.push(query.accountId);
    }
    if (query.categoryId) {
      clauses.push("category_id = ?");
      params.push(query.categoryId);
    }
    if (query.search) {
      clauses.push("soul_fold(note) LIKE ? ESCAPE '\\'");
      params.push(containsPattern(foldText(query.search)));
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    params.push(query.limit);
    return database
      .prepare<Array<string | number>, TransactionRow>(`SELECT * FROM transactions ${where} ORDER BY occurred_on DESC, created_at DESC LIMIT ?`)
      .all(...params)
      .map(toTransaction);
  }

  return {
    list,
    suggestions,
    create,
    update(id: string, input: TransactionInput): Transaction {
      requireTransaction(id);
      updateTransaction.run(input.accountId, input.categoryId, input.amountCents, input.occurredOn, input.note, id);
      return requireTransaction(id);
    },
    remove(id: string): void {
      const existing = selectTransaction.get(id);
      if (!existing) return;
      if (existing.transfer_group_id) deleteTransferGroup.run(existing.transfer_group_id);
      else deleteTransaction.run(id);
    },
    createTransfer: database.transaction((input: TransferInput): Transaction[] => {
      if (input.fromAccountId === input.toAccountId) throw new Error("Choose two different accounts.");
      const group = newId();
      const out = create({ accountId: input.fromAccountId, categoryId: null, amountCents: -input.amountCents, occurredOn: input.occurredOn, note: input.note }, { transferGroupId: group });
      const inbound = create({ accountId: input.toAccountId, categoryId: null, amountCents: input.amountCents, occurredOn: input.occurredOn, note: input.note }, { transferGroupId: group });
      return [out, inbound];
    }),
    exists: (accountId: string, occurredOn: IsoDate, amountCents: number, note: string): boolean => transactionExists.get(accountId, occurredOn, amountCents, note) !== undefined,
    insertMany: database.transaction((rows: readonly TransactionInput[]): number => {
      for (const row of rows) create(row);
      return rows.length;
    }),
  };
}
