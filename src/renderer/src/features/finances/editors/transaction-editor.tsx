import { useMemo, useState } from "react";
import type { Account, Category, Transaction, TransactionInput } from "@shared/contracts/finances";
import { todayIso } from "@shared/dates";
import { useMutation } from "@/lib/query";
import { Button, Field, InlineError, TextInput } from "@/components/primitives";
import { MoneyInput } from "@/components/pickers";
import { Sheet, SheetActions } from "@/components/sheet";
import { AccountSelect, CategoryChips, KindSwitch, type MoneyKind } from "./fields";

export function TransactionEditor({ transaction, accounts, categories, open, onClose, defaultAccountId }: { transaction: Transaction | null; accounts: readonly Account[]; categories: readonly Category[]; open: boolean; onClose: () => void; defaultAccountId?: string }) {
  const [kind, setKind] = useState<MoneyKind>(transaction && transaction.amountCents > 0 ? "income" : "expense");
  const [amount, setAmount] = useState<number | null>(transaction ? Math.abs(transaction.amountCents) : null);
  const [accountId, setAccountId] = useState(transaction?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string>(transaction?.categoryId ?? "");
  const [occurredOn, setOccurredOn] = useState(transaction?.occurredOn ?? todayIso());
  const [note, setNote] = useState(transaction?.note ?? "");
  const [validation, setValidation] = useState<string | null>(null);
  const create = useMutation("finances.transactions.create");
  const update = useMutation("finances.transactions.update");
  const remove = useMutation("finances.transactions.delete");
  const visibleCategories = useMemo(() => categories.filter((category) => category.archivedAt === null && category.kind === kind), [categories, kind]);

  const save = async () => {
    if (amount === null || amount <= 0) return setValidation("Enter an amount above zero.");
    if (!accountId) return setValidation("Choose an account.");
    setValidation(null);
    const input: TransactionInput = { accountId, categoryId: categoryId || null, amountCents: kind === "expense" ? -amount : amount, occurredOn, note: note.trim() };
    const saved = transaction ? await update.run({ id: transaction.id, input }) : await create.run(input);
    if (saved) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={transaction ? "Edit transaction" : "Add transaction"}
      footer={<SheetActions leading={transaction && <Button variant="danger" onClick={() => void remove.run({ id: transaction.id }).then(onClose)}>Delete</Button>} onCancel={onClose} onSave={() => void save()} saving={create.pending || update.pending} saveLabel={transaction ? "Save" : "Add"} />}
    >
      <KindSwitch value={kind} onChange={(next) => { setKind(next); setCategoryId(""); }} />
      <Field label="Amount"><MoneyInput valueCents={amount} onChange={setAmount} allowNegative={false} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Account"><AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} /></Field>
        <Field label="Date"><TextInput type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} /></Field>
      </div>
      <Field label="Category" group><CategoryChips categories={visibleCategories} value={categoryId} onChange={setCategoryId} /></Field>
      <Field label="Note"><TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was it for?" maxLength={2000} /></Field>
      <InlineError message={validation ?? create.error ?? update.error ?? remove.error} />
    </Sheet>
  );
}
