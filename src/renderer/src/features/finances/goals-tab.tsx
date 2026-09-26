import { Plus, Target } from "@phosphor-icons/react";
import { useState } from "react";
import type { SavingsGoal } from "@shared/contracts/finances";
import { formatCents } from "@shared/money";
import { invoke } from "@/lib/bridge";
import { useToasts } from "@/lib/toasts";
import { formatShortDate } from "@/lib/format";
import { Button, EmptyState, Field, Panel, Pill } from "@/components/primitives";
import { IconBadge } from "@/components/glyph";
import { MoneyInput } from "@/components/pickers";
import { ProgressBar } from "@/components/charts";
import { Modal } from "@/components/sheet";
import { GoalEditor } from "./editors/goal-editor";

export function GoalsTab({ goals }: { goals: readonly SavingsGoal[] }) {
  const [editing, setEditing] = useState<{ goal: SavingsGoal | null } | null>(null);
  const [contributing, setContributing] = useState<SavingsGoal | null>(null);
  return (
    <>
      <Panel
        title="Savings goals"
        meta={goals.length === 0 ? undefined : `${goals.filter((goal) => goal.achievedAt !== null).length} of ${goals.length} reached`}
        actions={<Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={() => setEditing({ goal: null })}>Goal</Button>}
      >
        {goals.length === 0 ? (
          <EmptyState icon={<Target size={22} />} title="No goals yet" description="Money you are setting aside for something specific, like a trip or an emergency fund." action={<Button variant="primary" onClick={() => setEditing({ goal: null })}>Create a goal</Button>} />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Goal</th><th className="w-[24%]">Progress</th><th className="num">Saved</th><th className="num">Target</th><th className="num hidden min-[1000px]:table-cell">Remaining</th><th className="hidden min-[1100px]:table-cell">Due</th><th className="num" /></tr>
            </thead>
            <tbody>
              {goals.map((goal) => {
                const done = goal.achievedAt !== null;
                return (
                  <tr key={goal.id}>
                    <td>
                      <button type="button" onClick={() => setEditing({ goal })} className="flex min-w-0 items-center gap-2.5 text-left hover:underline decoration-border-strong">
                        <IconBadge name={goal.icon} tone={goal.color} size={24} />
                        <span className="truncate font-medium">{goal.name}</span>
                      </button>
                    </td>
                    <td><ProgressBar value={goal.savedCents / goal.targetCents} tone={goal.color} /></td>
                    <td className="num">{formatCents(goal.savedCents)}</td>
                    <td className="num text-muted">{formatCents(goal.targetCents)}</td>
                    <td className="num hidden text-muted min-[1000px]:table-cell">{done ? "—" : formatCents(goal.targetCents - goal.savedCents)}</td>
                    <td className="hidden text-muted min-[1100px]:table-cell">{goal.targetDate ? formatShortDate(goal.targetDate) : "—"}</td>
                    <td className="num">{done ? <Pill tone="mint">Reached</Pill> : <Button size="sm" onClick={() => setContributing(goal)}>Add money</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
      {editing && <GoalEditor key={editing.goal?.id ?? "new"} goal={editing.goal} open onClose={() => setEditing(null)} />}
      {contributing && <ContributeModal goal={contributing} onClose={() => setContributing(null)} />}
    </>
  );
}

function ContributeModal({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const [amount, setAmount] = useState<number | null>(null);
  const [withdraw, setWithdraw] = useState(false);
  const { celebrate, push } = useToasts();
  const save = async () => {
    if (amount === null || amount <= 0) return;
    const result = await invoke("finances.goals.contribute", { id: goal.id, amountCents: withdraw ? -amount : amount }).catch((error: unknown) => {
      push({ title: "Could not update the goal", description: error instanceof Error ? error.message : undefined, tone: "danger" });
      return null;
    });
    if (result) {
      if (result.newMedals.length > 0) celebrate(result.newMedals);
      onClose();
    }
  };
  return (
    <Modal open onClose={onClose} title={`${withdraw ? "Take from" : "Add to"} ${goal.name}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void save()} disabled={amount === null || amount <= 0}>{withdraw ? "Withdraw" : "Add"}</Button></>}>
      <Field label="Amount"><MoneyInput valueCents={amount} onChange={setAmount} allowNegative={false} autoFocus /></Field>
      <button type="button" className="text-left text-[12.5px] text-muted hover:text-text" onClick={() => setWithdraw((value) => !value)}>{withdraw ? "Add money instead" : "Taking money out? Switch to withdraw"}</button>
      <p className="text-[12px] text-muted">This only tracks the goal. Record the actual transfer between accounts separately if you want the balances to move.</p>
    </Modal>
  );
}
