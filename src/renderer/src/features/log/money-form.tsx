import { Bank } from "@phosphor-icons/react";
import { useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { IsoDate } from "@shared/contracts/common";
import { formatSignedCents } from "@shared/money";
import { useMutation, useQuery } from "@/lib/query";
import { useNavigation } from "@/lib/navigation";
import { Button, EmptyState, Field, InlineError, TextInput } from "@/components/primitives";
import { MoneyInput } from "@/components/pickers";
import { AccountSelect, CategoryChips, type MoneyKind } from "@/features/finances/editors/fields";

export function MoneyForm({ kind, date, formId, onLogged }: { kind: MoneyKind; date: IsoDate; formId: string; onLogged: (message: string, keepOpen: boolean) => void }) {
  const { navigate } = useNavigation();
  const overview = useQuery("finances.overview", undefined, ["finances"]);
  const suggestions = useQuery("finances.transactions.suggestions", undefined, ["finances"]);
  const create = useMutation("finances.transactions.create");
  const listId = useId();
  const [amount, setAmount] = useState<number | null>(null);
  const [amountVersion, setAmountVersion] = useState(0);
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryChosen, setCategoryChosen] = useState(false);
  const [chosenAccountId, setAccountId] = useState("");
  const [accountChosen, setAccountChosen] = useState(false);
  const description = useRef<HTMLInputElement>(null);
  const [validation, setValidation] = useState<string | null>(null);

  const accounts = useMemo(() => (overview.data?.accounts ?? []).filter((account) => account.archivedAt === null), [overview.data]);
  const categories = useMemo(() => (overview.data?.categories ?? []).filter((category) => category.archivedAt === null && category.kind === kind), [overview.data, kind]);
  const matching = useMemo(() => (suggestions.data ?? []).filter((entry) => (kind === "expense" ? entry.amountCents < 0 : entry.amountCents > 0)), [suggestions.data, kind]);

  const accountId = accounts.some((account) => account.id === chosenAccountId) ? chosenAccountId : (accounts[0]?.id ?? "");

  if (overview.data && accounts.length === 0) {
    return <EmptyState icon={<Bank size={20} />} title="Add an account first" description="Money is logged against an account, like a bank account or cash." action={<Button onClick={() => navigate({ view: "finances" })}>Open Finance</Button>} />;
  }

  const describe = (value: string) => {
    setNote(value);
    const match = matching.find((entry) => entry.note.toLowerCase() === value.trim().toLowerCase());
    if (!match) return;
    if (!categoryChosen && match.categoryId && categories.some((category) => category.id === match.categoryId)) setCategoryId(match.categoryId);
    if (!accountChosen && accounts.some((account) => account.id === match.accountId)) setAccountId(match.accountId);
    if (amount === null) {
      setAmount(Math.abs(match.amountCents));
      setAmountVersion((version) => version + 1);
    }
  };

  const log = async (keepOpen: boolean) => {
    if (amount === null || amount <= 0) return setValidation("Enter an amount above zero.");
    if (!accountId) return setValidation("Choose an account.");
    setValidation(null);
    const signed = kind === "expense" ? -amount : amount;
    const saved = await create.run({ accountId, categoryId: categoryId || null, amountCents: signed, occurredOn: date, note: note.trim() });
    if (!saved) return;
    const category = categories.find((entry) => entry.id === categoryId);
    onLogged(`Logged ${formatSignedCents(signed)}${category ? ` · ${category.name}` : ""}`, keepOpen);
    if (keepOpen) {
      setAmount(null);
      setAmountVersion((version) => version + 1);
      setNote("");
      setCategoryId("");
      setCategoryChosen(false);
      description.current?.focus();
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void log(false);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void log(true);
    }
  };

  return (
    <form id={formId} onSubmit={submit} onKeyDown={onKeyDown} className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-3">
        <Field label="Description">
          <TextInput ref={description} autoFocus list={listId} value={note} onChange={(event) => describe(event.target.value)} placeholder={kind === "expense" ? "Coffee, groceries, taxi…" : "Salary, refund, sold something…"} maxLength={2000} />
          <datalist id={listId}>
            {matching.map((entry) => <option key={entry.note} value={entry.note} />)}
          </datalist>
        </Field>
        <Field label="Amount"><MoneyInput key={amountVersion} valueCents={amount} onChange={setAmount} allowNegative={false} /></Field>
      </div>
      <Field label="Category" group>
        <CategoryChips categories={categories} value={categoryId} onChange={(id) => { setCategoryId(id); setCategoryChosen(true); }} />
      </Field>
      <Field label="Account" className="max-w-[260px]"><AccountSelect accounts={accounts} value={accountId} onChange={(id) => { setAccountId(id); setAccountChosen(true); }} keepArchived={false} /></Field>
      <InlineError message={validation ?? create.error} />
    </form>
  );
}
