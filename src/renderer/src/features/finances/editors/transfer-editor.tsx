import { useState } from "react";
import type { Account } from "@shared/contracts/finances";
import { todayIso } from "@shared/dates";
import { useMutation } from "@/lib/query";
import { Field, InlineError, TextInput } from "@/components/primitives";
import { MoneyInput } from "@/components/pickers";
import { Sheet, SheetActions } from "@/components/sheet";
import { AccountSelect } from "./fields";

export function TransferEditor({ accounts, open, onClose }: { accounts: readonly Account[]; open: boolean; onClose: () => void }) {
  const live = accounts.filter((account) => account.archivedAt === null);
  const [fromAccountId, setFrom] = useState(live[0]?.id ?? "");
  const [toAccountId, setTo] = useState(live[1]?.id ?? "");
  const [amount, setAmount] = useState<number | null>(null);
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [note, setNote] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const create = useMutation("finances.transfers.create");
  const save = async () => {
    if (amount === null || amount <= 0) return setValidation("Enter an amount above zero.");
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) return setValidation("Choose two different accounts.");
    setValidation(null);
    const saved = await create.run({ fromAccountId, toAccountId, amountCents: amount, occurredOn, note: note.trim() });
    if (saved) onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Move money between accounts" footer={<SheetActions onCancel={onClose} onSave={() => void save()} saving={create.pending} saveLabel="Transfer" />}>
      <Field label="Amount"><MoneyInput valueCents={amount} onChange={setAmount} allowNegative={false} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="From"><AccountSelect accounts={live} value={fromAccountId} onChange={setFrom} keepArchived={false} /></Field>
        <Field label="To"><AccountSelect accounts={live} value={toAccountId} onChange={setTo} keepArchived={false} /></Field>
      </div>
      <Field label="Date"><TextInput type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} /></Field>
      <Field label="Note"><TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" /></Field>
      <InlineError message={validation ?? create.error} />
    </Sheet>
  );
}
