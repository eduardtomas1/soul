import { PencilSimple, Plus, Tag } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import type { Category, FinanceOverview } from "@shared/contracts/finances";
import { formatCents } from "@shared/money";
import { invoke } from "@/lib/bridge";
import { formatMonth } from "@/lib/format";
import { Button, EmptyState, IconButton, Panel } from "@/components/primitives";
import { MoneyInput } from "@/components/pickers";
import { CategoryLabel } from "@/components/category-label";
import { ProgressBar } from "@/components/charts";

export function BudgetsTab({ data, onEditCategory, onNewCategory }: { data: FinanceOverview; onEditCategory: (category: Category) => void; onNewCategory: () => void }) {
  const limits = useMemo(() => new Map(data.budgets.map((budget) => [budget.categoryId, budget.monthlyLimitCents])), [data.budgets]);
  const spent = useMemo(() => new Map(data.currentMonth.byCategory.map((entry) => [entry.categoryId, entry.spentCents])), [data.currentMonth]);
  const expenseCategories = data.categories.filter((category) => category.kind === "expense" && category.archivedAt === null);
  const totalLimit = data.budgets.reduce((sum, budget) => sum + budget.monthlyLimitCents, 0);
  const totalSpentInBudgets = data.budgets.reduce((sum, budget) => sum + (spent.get(budget.categoryId) ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="Budgets"
        meta={`${formatMonth(data.currentMonth.month)} · ${data.budgets.length === 0 ? "no budgets yet" : `${formatCents(totalSpentInBudgets)} of ${formatCents(totalLimit)} used`}`}
        actions={<Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={onNewCategory}>Category</Button>}
      >
        {expenseCategories.length === 0 ? (
          <EmptyState icon={<Tag size={22} />} title="No expense categories" action={<Button onClick={onNewCategory}>Add a category</Button>} />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Category</th><th className="w-[30%]">Used</th><th className="num">Spent</th><th className="num">Budget</th><th className="num">Remaining</th><th className="w-10" /></tr>
            </thead>
            <tbody>
              {expenseCategories.map((category) => (
                <BudgetRow key={category.id} category={category} limit={limits.get(category.id) ?? null} spent={spent.get(category.id) ?? 0} onEdit={() => onEditCategory(category)} />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <p className="text-[12px] text-muted">Close a month without going over any budget to reach the Budget keeper milestone.</p>
    </div>
  );
}

function BudgetRow({ category, limit, spent, onEdit }: { category: Category; limit: number | null; spent: number; onEdit: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | null>(limit);
  const over = limit !== null && spent > limit;
  const save = async () => {
    await invoke("finances.budgets.set", { categoryId: category.id, monthlyLimitCents: draft });
    setEditing(false);
  };
  return (
    <tr>
      <td><CategoryLabel category={category} className="font-medium" /></td>
      <td>{limit !== null ? <ProgressBar value={spent / limit} tone={category.color} over={over} /> : <span className="text-[12px] text-faint">No budget</span>}</td>
      <td className={clsx("num", over && "text-danger")}>{formatCents(spent)}</td>
      <td className="num">
        {editing ? (
          <div className="flex items-center justify-end gap-1.5">
            <MoneyInput valueCents={draft} onChange={setDraft} allowNegative={false} className="w-[120px]" autoFocus />
            <Button size="sm" variant="primary" onClick={() => void save()}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(limit); setEditing(false); }}>Cancel</Button>
            {limit !== null && <Button size="sm" variant="ghost" onClick={() => { setDraft(null); void invoke("finances.budgets.set", { categoryId: category.id, monthlyLimitCents: null }).then(() => setEditing(false)); }}>Remove</Button>}
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className={clsx("hover:underline decoration-border-strong", limit === null ? "text-link" : "text-text")}>
            {limit === null ? "Set budget" : formatCents(limit)}
          </button>
        )}
      </td>
      <td className={clsx("num", over ? "text-danger" : "text-muted")}>{limit === null ? "—" : over ? `−${formatCents(spent - limit)}` : formatCents(limit - spent)}</td>
      <td className="num"><IconButton label="Edit category" size="sm" onClick={onEdit}><PencilSimple size={14} /></IconButton></td>
    </tr>
  );
}
