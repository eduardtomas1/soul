import { useState } from "react";
import type { Account, Category, RecurringRule, RecurringRuleInput } from "@shared/contracts/finances";
import { todayIso } from "@shared/dates";
import { useMutation } from "@/lib/query";
import { Button, Field, InlineError, Select, TextInput, Toggle } from "@/components/primitives";
import { MoneyInput } from "@/components/pickers";
import { Sheet, SheetActions } from "@/components/sheet";
import { AccountSelect, KindSwitch, type MoneyKind } from "./fields";

export function RecurringEditor({ rule, accounts, categories, open, onClose }: { rule: RecurringRule | null; accounts: readonly Account[]; categories: readonly Category[]; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(rule?.name ?? "");
  const [kind, setKind] = useState<MoneyKind>(rule && rule.amountCents > 0 ? "income" : "expense");
  const [amount, setAmount] = useState<number | null>(rule ? Math.abs(rule.amountCents) : null);
  const [accountId, setAccountId] = useState(rule?.accountId ?? accounts.find((account) => account.archivedAt === null)?.id ?? "");
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? "");
  const [frequency, setFrequency] = useState<RecurringRule["frequency"]>(rule?.frequency ?? "monthly");
  const [interval, setInterval] = useState(rule?.interval ?? 1);
  const [anchorDate, setAnchorDate] = useState(rule?.anchorDate ?? todayIso());
  const [endDate, setEndDate] = useState(rule?.endDate ?? "");
  const [autoPost, setAutoPost] = useState(rule?.autoPost ?? true);
  const [validation, setValidation] = useState<string | null>(null);
  const create = useMutation("finances.recurring.create");
  const update = useMutation("finances.recurring.update");
  const remove = useMutation("finances.recurring.delete");
  const visibleCategories = categories.filter((category) => category.archivedAt === null && category.kind === kind);
  const save = async () => {
    if (name.trim().length === 0) return setValidation("Give it a name.");
    if (amount === null || amount <= 0) return setValidation("Enter an amount above zero.");
    if (!accountId) return setValidation("Choose an account.");
    setValidation(null);
    const input: RecurringRuleInput = { name: name.trim(), accountId, categoryId: categoryId || null, amountCents: kind === "expense" ? -amount : amount, frequency, interval: Math.max(1, Math.min(52, Math.round(interval))), anchorDate, endDate: endDate || null, autoPost };
    const saved = rule ? await update.run({ id: rule.id, input }) : await create.run(input);
    if (saved) onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={rule ? "Edit recurring" : "New recurring payment"}
      description="Salary, rent, subscriptions. Soul records them on their due date and uses them for the forecast."
      footer={<SheetActions leading={rule && <Button variant="danger" onClick={() => void remove.run({ id: rule.id }).then(onClose)}>Delete</Button>} onCancel={onClose} onSave={() => void save()} saving={create.pending || update.pending} saveLabel={rule ? "Save" : "Create"} />}
    >
      <Field label="Name"><TextInput autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Rent" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Kind" group><KindSwitch value={kind} onChange={(next) => { setKind(next); setCategoryId(""); }} /></Field>
        <Field label="Amount"><MoneyInput valueCents={amount} onChange={setAmount} allowNegative={false} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Account"><AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} /></Field>
        <Field label="Category">
          <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">None</option>
            {visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Repeats">
          <div className="flex gap-2">
            <TextInput type="number" min={1} max={52} value={interval} onChange={(event) => setInterval(Number(event.target.value))} className="w-16 text-center" aria-label="Every" />
            <Select value={frequency} onChange={(event) => setFrequency(event.target.value as RecurringRule["frequency"])}>
              <option value="weekly">{interval === 1 ? "week" : "weeks"}</option>
              <option value="monthly">{interval === 1 ? "month" : "months"}</option>
              <option value="yearly">{interval === 1 ? "year" : "years"}</option>
            </Select>
          </div>
        </Field>
        <Field label="First date" hint="The day of month or week is taken from here."><TextInput type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} /></Field>
      </div>
      <Field label="Ends" hint="Optional."><TextInput type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field>
      <div className="card px-4 py-1"><Toggle checked={autoPost} onChange={setAutoPost} label="Post automatically" description="Record the transaction on the due date. Turn off to confirm each payment yourself." /></div>
      <InlineError message={validation ?? create.error ?? update.error ?? remove.error} />
    </Sheet>
  );
}
