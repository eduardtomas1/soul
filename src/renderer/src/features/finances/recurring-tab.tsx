import { CalendarBlank, Plus, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { IsoDate } from "@shared/contracts/common";
import type { Account, Category, RecurringRule } from "@shared/contracts/finances";
import { invoke } from "@/lib/bridge";
import { useToday } from "@/lib/clock";
import { formatRelativeDay, formatShortDate, pluralize } from "@/lib/format";
import { useToasts } from "@/lib/toasts";
import { occurrencesBetween } from "@shared/recurrence";
import { Button, EmptyState, Metrics, Panel, Pill, RowButton } from "@/components/primitives";
import { CategoryLabel } from "@/components/category-label";
import { Amount } from "@/components/pickers";
import { RecurringEditor } from "./editors/recurring-editor";

export function RecurringTab({ accounts, categories, rules, openNew }: { accounts: readonly Account[]; categories: readonly Category[]; rules: readonly RecurringRule[]; openNew: boolean }) {
  const today = useToday();
  const { push } = useToasts();
  const [settling, setSettling] = useState(false);
  const [editing, setEditing] = useState<{ rule: RecurringRule | null } | null>(openNew ? { rule: null } : null);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const monthlyIncome = rules.filter((rule) => rule.amountCents > 0).reduce((sum, rule) => sum + monthlyEquivalent(rule), 0);
  const monthlyExpense = rules.filter((rule) => rule.amountCents < 0).reduce((sum, rule) => sum + monthlyEquivalent(rule), 0);
  const sorted = [...rules].sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn));
  const duePayments = rules.filter((rule) => !rule.autoPost && rule.nextDueOn <= today).reduce((sum, rule) => sum + occurrencesBetween(rule, rule.nextDueOn, today).length, 0);

  const settle = async (action: "post" | "skip") => {
    setSettling(true);
    try {
      if (action === "post") {
        const { posted } = await invoke("finances.recurring.postDue");
        push({ title: `Posted ${pluralize(posted, "payment")}`, tone: "success" });
      } else {
        const { skipped } = await invoke("finances.recurring.skipDue");
        push({ title: `Skipped ${pluralize(skipped, "payment")}`, description: "Nothing was recorded. They stay in your projections.", tone: "neutral" });
      }
    } catch (caught) {
      push({ title: action === "post" ? "Could not post the payments" : "Could not skip the payments", description: caught instanceof Error ? caught.message : undefined, tone: "danger" });
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Metrics
        items={[
          { label: "Monthly income", value: <Amount cents={monthlyIncome} />, hint: "recurring, monthly equivalent" },
          { label: "Monthly outgoings", value: <Amount cents={-monthlyExpense} />, hint: "recurring, monthly equivalent" },
          { label: "Net", value: <Amount cents={monthlyIncome + monthlyExpense} signed />, hint: "yearly items spread over 12 months" },
        ]}
      />
      {duePayments > 0 && (
        <div role="status" className="flex items-center gap-3 rounded-[8px] border border-warning/40 bg-warning/5 px-5 py-3">
          <WarningCircle size={18} className="shrink-0 text-warning" />
          <span className="flex-1 text-[13px]">
            {duePayments === 1 ? "One manual payment is due. Post it to record it on its date, or skip it if you already entered it." : `${duePayments} manual payments are due. Post them to record each on its date, or skip them if you already entered them.`}
          </span>
          <Button size="sm" variant="ghost" disabled={settling} onClick={() => void settle("skip")}>Skip</Button>
          <Button size="sm" loading={settling} onClick={() => void settle("post")}>{duePayments === 1 ? "Post" : `Post ${duePayments}`}</Button>
        </div>
      )}
      <Panel title="Recurring payments" meta={rules.length > 0 ? String(rules.length) : undefined} actions={<Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={() => setEditing({ rule: null })}>Recurring</Button>}>
        {rules.length === 0 ? (
          <EmptyState icon={<CalendarBlank size={22} />} title="Nothing repeats yet" description="Salary, rent, subscriptions. Soul records them on their due date and uses them for the forecast." action={<Button variant="primary" onClick={() => setEditing({ rule: null })}>Add a recurring payment</Button>} />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Payment</th><th>Schedule</th><th>Category</th><th>Account</th><th>Next</th><th className="num">Amount</th></tr>
            </thead>
            <tbody>
              {sorted.map((rule) => {
                const category = rule.categoryId ? categoryById.get(rule.categoryId) : undefined;
                const overdue = !rule.autoPost && rule.nextDueOn <= today && (rule.endDate === null || rule.nextDueOn <= rule.endDate);
                return (
                  <tr key={rule.id} className="row-link" onClick={() => setEditing({ rule })}>
                    <td>
                      <RowButton onClick={() => setEditing({ rule })} className="gap-2">
                        <span className="truncate font-medium">{rule.name}</span>
                        {!rule.autoPost && <Pill>Manual</Pill>}
                      </RowButton>
                    </td>
                    <td className="text-muted">{describeFrequency(rule)}</td>
                    <td className="text-muted"><CategoryLabel category={category} /></td>
                    <td className="text-muted">{accountById.get(rule.accountId)?.name ?? "—"}</td>
                    <td className={overdue ? "text-warning" : "text-muted"}>{dueLabel(rule, today)}</td>
                    <td className="num"><Amount cents={rule.amountCents} signed /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
      {editing && <RecurringEditor key={editing.rule?.id ?? "new"} rule={editing.rule} accounts={accounts} categories={categories} open onClose={() => setEditing(null)} />}
    </div>
  );
}

function dueLabel(rule: RecurringRule, today: IsoDate): string {
  if (rule.endDate && rule.nextDueOn > rule.endDate) return "Ended";
  if (rule.nextDueOn < today) return `Due since ${formatShortDate(rule.nextDueOn)}`;
  if (rule.nextDueOn === today) return "Due today";
  return formatRelativeDay(rule.nextDueOn, today);
}

function monthlyEquivalent(rule: RecurringRule): number {
  const perMonth = rule.frequency === "weekly" ? (52 / 12) / rule.interval : rule.frequency === "monthly" ? 1 / rule.interval : 1 / (12 * rule.interval);
  return Math.round(rule.amountCents * perMonth);
}

function describeFrequency(rule: RecurringRule): string {
  const unit = rule.frequency === "weekly" ? "week" : rule.frequency === "monthly" ? "month" : "year";
  return rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`;
}
