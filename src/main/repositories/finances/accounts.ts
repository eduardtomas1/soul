import type { SoulDatabase } from "../../database/open";
import { newId, nowIso } from "../../database/ids";
import type { Account, AccountInput } from "@shared/contracts/finances";
import { toAccount, type AccountRow } from "./rows";

export interface AccountsStore {
  readonly list: () => Account[];
  readonly get: (id: string) => Account | null;
  readonly create: (input: AccountInput) => Account;
  readonly update: (id: string, input: AccountInput) => Account;
  readonly setArchived: (id: string, archived: boolean) => Account;
  readonly remove: (id: string) => void;
}

export function createAccountsStore(database: SoulDatabase): AccountsStore {
  const accountSelect = `
    SELECT a.*, a.opening_balance_cents + COALESCE((SELECT SUM(t.amount_cents) FROM transactions t WHERE t.account_id = a.id), 0) AS balance_cents
    FROM accounts a`;
  const selectAccounts = database.prepare<[], AccountRow>(`${accountSelect} ORDER BY a.sort_order, a.created_at`);
  const selectAccount = database.prepare<[string], AccountRow>(`${accountSelect} WHERE a.id = ?`);
  const insertAccount = database.prepare<[string, string, string, string, string, number, number, string]>(
    "INSERT INTO accounts (id, name, kind, icon, color, opening_balance_cents, sort_order, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)",
  );
  const updateAccount = database.prepare<[string, string, string, string, number, string]>(
    "UPDATE accounts SET name = ?, kind = ?, icon = ?, color = ?, opening_balance_cents = ? WHERE id = ?",
  );
  const archiveAccount = database.prepare<[string | null, string]>("UPDATE accounts SET archived_at = ? WHERE id = ?");
  const deleteAccount = database.prepare<[string]>("DELETE FROM accounts WHERE id = ?");
  const maxAccountSort = database.prepare<[], { max: number | null }>("SELECT MAX(sort_order) AS max FROM accounts");

  function get(id: string): Account | null {
    const row = selectAccount.get(id);
    return row ? toAccount(row) : null;
  }

  function requireAccount(id: string): Account {
    const account = get(id);
    if (!account) throw new Error("Account not found.");
    return account;
  }

  return {
    list: () => selectAccounts.all().map(toAccount),
    get,
    create(input: AccountInput): Account {
      const id = newId();
      insertAccount.run(id, input.name, input.kind, input.icon, input.color, input.openingBalanceCents, (maxAccountSort.get()?.max ?? -1) + 1, nowIso());
      return requireAccount(id);
    },
    update(id: string, input: AccountInput): Account {
      requireAccount(id);
      updateAccount.run(input.name, input.kind, input.icon, input.color, input.openingBalanceCents, id);
      return requireAccount(id);
    },
    setArchived(id: string, archived: boolean): Account {
      archiveAccount.run(archived ? nowIso() : null, id);
      return requireAccount(id);
    },
    remove(id: string): void {
      deleteAccount.run(id);
    },
  };
}
