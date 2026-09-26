import { clsx } from "clsx";
import type { Account, Category } from "@shared/contracts/finances";
import { Glyph } from "@/components/glyph";
import { Segmented, Select } from "@/components/primitives";

export type MoneyKind = "expense" | "income";

export function KindSwitch({ value, onChange }: { value: MoneyKind; onChange: (value: MoneyKind) => void }) {
  return <Segmented value={value} onChange={onChange} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} />;
}

export function AccountSelect({ accounts, value, onChange, keepArchived = true }: { accounts: readonly Account[]; value: string; onChange: (id: string) => void; keepArchived?: boolean }) {
  const options = accounts.filter((account) => account.archivedAt === null || (keepArchived && account.id === value));
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
    </Select>
  );
}

export function CategoryChips({ categories, value, onChange }: { categories: readonly Category[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((category) => {
        const selected = value === category.id;
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? "" : category.id)}
            className={clsx(`tone-${category.color}`, "inline-flex h-7 items-center gap-1.5 rounded-[6px] border px-2 text-[12.5px] font-medium transition-colors", selected ? "border-text bg-surface-2 text-text" : "border-border-strong text-muted hover:bg-surface-2 hover:text-text")}
          >
            <Glyph name={category.icon} size={14} className="text-[var(--tone)]" />
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
