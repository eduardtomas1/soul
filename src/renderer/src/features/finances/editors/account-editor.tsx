import { useState } from "react";
import type { ColorToken } from "@shared/contracts/common";
import type { Account, AccountInput } from "@shared/contracts/finances";
import { DEFAULT_ACCOUNT_ICON } from "@shared/icons";
import { useMutation } from "@/lib/query";
import { Button, Field, InlineError, Select, TextInput } from "@/components/primitives";
import { MoneyInput } from "@/components/pickers";
import { IconAndColor } from "@/components/icon-and-color";
import { Sheet, SheetActions } from "@/components/sheet";

export function AccountEditor({ account, open, onClose }: { account: Account | null; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<Account["kind"]>(account?.kind ?? "checking");
  const [icon, setIcon] = useState<string>(account?.icon ?? DEFAULT_ACCOUNT_ICON);
  const [color, setColor] = useState<ColorToken>(account?.color ?? "sky");
  const [opening, setOpening] = useState<number | null>(account?.openingBalanceCents ?? 0);
  const [validation, setValidation] = useState<string | null>(null);
  const create = useMutation("finances.accounts.create");
  const update = useMutation("finances.accounts.update");
  const archive = useMutation("finances.accounts.archive");
  const save = async () => {
    if (name.trim().length === 0) return setValidation("Give the account a name.");
    if (opening === null) return setValidation("Enter an opening balance, even if it is zero.");
    setValidation(null);
    const input: AccountInput = { name: name.trim(), kind, icon, color, openingBalanceCents: opening };
    const saved = account ? await update.run({ id: account.id, input }) : await create.run(input);
    if (saved) onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={account ? "Edit account" : "New account"}
      description="Balances are the opening balance plus every transaction recorded here."
      footer={<SheetActions leading={account && <Button variant="ghost" onClick={() => void archive.run({ id: account.id, archived: account.archivedAt === null }).then(onClose)}>{account.archivedAt ? "Restore" : "Archive"}</Button>} onCancel={onClose} onSave={() => void save()} saving={create.pending || update.pending} saveLabel={account ? "Save" : "Create"} />}
    >
      <IconAndColor icon={icon} color={color} onIcon={setIcon} onColor={setColor}>
        <Field label="Name"><TextInput autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Main account" /></Field>
      </IconAndColor>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <Select value={kind} onChange={(event) => setKind(event.target.value as Account["kind"])}>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="cash">Cash</option>
            <option value="card">Credit card</option>
            <option value="investment">Investment</option>
          </Select>
        </Field>
        <Field label="Opening balance"><MoneyInput valueCents={opening} onChange={setOpening} /></Field>
      </div>
      <InlineError message={validation ?? create.error ?? update.error} />
    </Sheet>
  );
}
