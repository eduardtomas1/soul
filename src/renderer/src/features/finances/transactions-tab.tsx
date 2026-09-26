import { CaretLeft, CaretRight, MagnifyingGlass, Receipt } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import type { Account, Category, Transaction } from "@shared/contracts/finances";
import { addMonthsToMonth, firstDayOfMonth, lastDayOfMonth, monthOf, todayIso } from "@shared/dates";
import { formatCents } from "@shared/money";
import { invoke } from "@/lib/bridge";
import { useQuery } from "@/lib/query";
import { formatLongDate, formatMonth, formatShortDate, pluralize } from "@/lib/format";
import { Button, EmptyState, IconButton, InlineError, Panel, Pill, RowButton, Select, TextInput } from "@/components/primitives";
import { CategoryLabel } from "@/components/category-label";
import { Amount } from "@/components/pickers";
import { Modal } from "@/components/sheet";
import { TransactionEditor } from "./editors/transaction-editor";

export function TransactionsTab({ accounts, categories }: { accounts: readonly Account[]; categories: readonly Category[] }) {
  const [month, setMonth] = useState(monthOf(todayIso()));
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [transfer, setTransfer] = useState<Transaction | null>(null);
  const query = useMemo(() => ({ from: firstDayOfMonth(month), to: lastDayOfMonth(month), limit: 2_000, ...(accountId ? { accountId } : {}), ...(search.trim() ? { search: search.trim() } : {}) }), [month, accountId, search]);
  const transactions = useQuery("finances.transactions.list", query, ["finances"]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const rows = useMemo(() => transactions.data ?? [], [transactions.data]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const transaction of rows) {
      if (transaction.transferGroupId) continue;
      if (transaction.amountCents > 0) income += transaction.amountCents;
      else expense += -transaction.amountCents;
    }
    return { income, expense };
  }, [rows]);

  const open = (transaction: Transaction) => (transaction.transferGroupId !== null ? setTransfer(transaction) : setEditing(transaction));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 items-center rounded-[6px] border border-border-strong bg-surface">
          <IconButton label="Previous month" size="sm" onClick={() => setMonth(addMonthsToMonth(month, -1))}><CaretLeft size={13} /></IconButton>
          <span className="w-[140px] text-center text-[13px] font-medium">{formatMonth(month)}</span>
          <IconButton label="Next month" size="sm" onClick={() => setMonth(addMonthsToMonth(month, 1))}><CaretRight size={13} /></IconButton>
        </div>
        <div className="w-[180px]">
          <Select value={accountId} onChange={(event) => setAccountId(event.target.value)} aria-label="Account">
            <option value="">All accounts</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </Select>
        </div>
        <div className="relative w-[240px]">
          <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes" className="pl-7" />
        </div>
        <div className="ml-auto flex gap-5 text-[12.5px] text-muted tabular-nums">
          <span>In <Amount cents={totals.income} className="font-medium text-text" /></span>
          <span>Out <Amount cents={totals.expense} className="font-medium text-text" /></span>
        </div>
      </div>
      <Panel title="Ledger" meta={transactions.data ? pluralize(rows.length, "entry", "entries") : undefined}>
        {transactions.data && rows.length === 0 ? (
          <EmptyState icon={<Receipt size={22} />} title="No transactions here" description="Add one with the button above, or import a bank statement from the Import tab." />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th className="w-[92px]">Date</th><th>Description</th><th>Category</th><th>Account</th><th className="num">Amount</th></tr>
            </thead>
            <tbody>
              {rows.map((transaction) => {
                const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined;
                const account = accountById.get(transaction.accountId);
                const isTransfer = transaction.transferGroupId !== null;
                return (
                  <tr key={transaction.id} className="row-link" onClick={() => open(transaction)}>
                    <td className="text-muted">{formatShortDate(transaction.occurredOn)}</td>
                    <td>
                      <RowButton onClick={() => open(transaction)} className="gap-2">
                        <span className="truncate">{transaction.note || category?.name || (isTransfer ? "Transfer" : "Transaction")}</span>
                        {transaction.recurringRuleId && <Pill>Recurring</Pill>}
                      </RowButton>
                    </td>
                    <td className="text-muted">
                      {isTransfer ? "Transfer" : <CategoryLabel category={category} />}
                    </td>
                    <td className="text-muted">{account?.name ?? "—"}</td>
                    <td className="num"><Amount cents={transaction.amountCents} signed muted={isTransfer} className={clsx(isTransfer && "text-muted")} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
      {editing && <TransactionEditor key={editing.id} transaction={editing} accounts={accounts} categories={categories} open onClose={() => setEditing(null)} />}
      {transfer && <TransferModal transaction={transfer} legs={rows.filter((entry) => entry.transferGroupId === transfer.transferGroupId)} accountById={accountById} onClose={() => setTransfer(null)} />}
    </div>
  );
}

function TransferModal({ transaction, legs, accountById, onClose }: { transaction: Transaction; legs: readonly Transaction[]; accountById: ReadonlyMap<string, Account>; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outgoing = legs.find((leg) => leg.amountCents < 0);
  const incoming = legs.find((leg) => leg.amountCents > 0);
  const nameOf = (leg: Transaction | undefined) => (leg ? accountById.get(leg.accountId)?.name ?? "an account" : "another account");
  const confirm = async () => {
    setPending(true);
    try {
      await invoke("finances.transactions.delete", { id: transaction.id });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the transfer.");
      setPending(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Transfer between accounts"
      footer={<><Button variant="ghost" onClick={onClose}>Keep it</Button><Button variant="danger" onClick={() => void confirm()} loading={pending}>Delete transfer</Button></>}
    >
      <p className="text-[13px]">{formatCents(Math.abs(transaction.amountCents))} from {nameOf(outgoing)} to {nameOf(incoming)} on {formatLongDate(transaction.occurredOn)}.</p>
      {transaction.note && <p className="text-[13px] text-muted">{transaction.note}</p>}
      <p className="text-[12.5px] text-muted">Deleting it removes both sides, so both balances go back to how they were.</p>
      <InlineError message={error} />
    </Modal>
  );
}
