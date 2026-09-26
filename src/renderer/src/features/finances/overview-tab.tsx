import { Plus } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import type { Account, Category, FinanceOverview, MonthTrend } from "@shared/contracts/finances";
import { formatCents, formatCentsCompact } from "@shared/money";
import { useQuery } from "@/lib/query";
import { formatMonth, formatShortMonth, pluralize } from "@/lib/format";
import { Button, Columns, Panel, RowButton, Stack } from "@/components/primitives";
import { CategoryLabel } from "@/components/category-label";
import { IconBadge } from "@/components/glyph";
import { Amount } from "@/components/pickers";
import { KpiGrid, deltaOf } from "@/components/kpi";
import { BreakdownBar, ColumnChart, LineChart, ProgressBar } from "@/components/charts";

const ACCOUNT_KINDS: Record<Account["kind"], string> = { checking: "Checking", savings: "Savings", cash: "Cash", card: "Credit card", investment: "Investment" };
const TREND_MONTHS = 12;

const money = (value: number) => formatCents(Math.round(value));
const MIN_MONTHS = 3;

function fromFirstActivity(history: readonly MonthTrend[]): MonthTrend[] {
  const first = history.findIndex((month) => month.incomeCents > 0 || month.expenseCents > 0);
  if (first < 0) return history.slice(-MIN_MONTHS);
  return history.slice(Math.min(first, Math.max(0, history.length - MIN_MONTHS)));
}

export function OverviewTab({ data, onEditAccount, onNewAccount, onEditCategory, onNewCategory }: { data: FinanceOverview; onEditAccount: (account: Account) => void; onNewAccount: () => void; onEditCategory: (category: Category) => void; onNewCategory: () => void }) {
  const projection = useQuery("finances.projection", { months: 6 }, ["finances"]);
  const trends = useQuery("finances.trends", { months: TREND_MONTHS }, ["finances"]);
  const categories = useMemo(() => new Map(data.categories.map((category) => [category.id, category])), [data.categories]);
  const spending = data.currentMonth.byCategory.filter((entry) => entry.spentCents > 0);
  const liveAccounts = data.accounts.filter((account) => account.archivedAt === null);
  const [showArchivedAccounts, setShowArchivedAccounts] = useState(false);
  const archivedAccounts = data.accounts.filter((account) => account.archivedAt !== null);
  const months = projection.data?.months ?? [];
  const lastMonth = months[months.length - 1];
  const history = useMemo(() => fromFirstActivity(trends.data ?? []), [trends.data]);
  const monthEndBefore = history[history.length - 2]?.netWorthCents;
  const lastMonthSoFar = data.previousMonthToDate;
  const incomeChange = data.currentMonth.incomeCents - lastMonthSoFar.incomeCents;
  const spendingChange = data.currentMonth.expenseCents - lastMonthSoFar.expenseCents;

  return (
    <>
      <KpiGrid
        items={[
          {
            label: "Net worth",
            value: data.netWorthCents,
            format: money,
            hint: pluralize(liveAccounts.length, "account"),
            delta: monthEndBefore === undefined ? null : deltaOf(data.netWorthCents - monthEndBefore, formatCentsCompact(Math.abs(data.netWorthCents - monthEndBefore)), true),
            trend: history.map((month) => month.netWorthCents),
          },
          {
            label: "Income this month",
            value: data.currentMonth.incomeCents,
            format: money,
            hint: `${formatCents(lastMonthSoFar.incomeCents)} by this day last month`,
            delta: deltaOf(incomeChange, formatCentsCompact(Math.abs(incomeChange)), true),
            trend: history.map((month) => month.incomeCents),
            trendColor: "var(--success)",
          },
          {
            label: "Spent this month",
            value: data.currentMonth.expenseCents,
            format: money,
            hint: `${formatCents(lastMonthSoFar.expenseCents)} by this day last month`,
            delta: deltaOf(spendingChange, formatCentsCompact(Math.abs(spendingChange)), false),
            trend: history.map((month) => month.expenseCents),
            trendColor: "var(--text)",
          },
          {
            label: "In 6 months",
            value: lastMonth?.closingCents ?? 0,
            format: (value) => (lastMonth ? money(value) : "—"),
            hint: projection.data ? `Forecast from ${formatCents(projection.data.startingCents)} today` : "Forecast",
            trend: months.map((month) => month.closingCents),
            valueClassName: clsx(lastMonth && lastMonth.closingCents < 0 && "text-danger"),
          },
        ]}
      />
      <Columns>
        <Panel title="Net worth" meta={`last ${history.length} months`}>
          <div className="px-4 pt-4 pb-3">
            {history.length > 0 && (
              <LineChart
                axisStep={100}
                labels={history.map((month) => formatShortMonth(month.month))}
                titles={history.map((month) => formatMonth(month.month))}
                height={210}
                ariaLabel="Net worth at the end of each month"
                format={formatCents}
                formatAxis={formatCentsCompact}
                series={[{ name: "Net worth", color: "var(--signal)", values: history.map((month) => month.netWorthCents), area: true }]}
              />
            )}
          </div>
        </Panel>
        <Panel title="Income and spending" meta={`last ${history.length} months`}>
          <div className="px-4 pt-4">
            {history.length > 0 && (
              <ColumnChart
                axisStep={100}
                labels={history.map((month) => formatShortMonth(month.month))}
                titles={history.map((month) => formatMonth(month.month))}
                height={210}
                ariaLabel="Income and spending each month"
                format={formatCents}
                formatAxis={formatCentsCompact}
                series={[
                  { name: "Income", color: "var(--signal)", values: history.map((month) => month.incomeCents) },
                  { name: "Spending", color: "var(--series-2)", values: history.map((month) => month.expenseCents) },
                ]}
              />
            )}
          </div>
          <div className="flex gap-4 px-5 pb-4 text-[11.5px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-signal" />Income</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-series-2" />Spending, transfers excluded</span>
          </div>
        </Panel>
      </Columns>
      <Columns>
        <Stack>
          <Panel title="Accounts" meta={String(liveAccounts.length)} actions={<Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={onNewAccount}>Account</Button>}>
            <table className="data-table">
              <thead>
                <tr><th>Account</th><th>Type</th><th className="num">Balance</th></tr>
              </thead>
              <tbody>
                {liveAccounts.map((account) => (
                  <tr key={account.id} className="row-link" onClick={() => onEditAccount(account)}>
                    <td>
                      <RowButton onClick={() => onEditAccount(account)}>
                        <IconBadge name={account.icon} tone={account.color} size={28} />
                        <span className="truncate font-medium">{account.name}</span>
                      </RowButton>
                    </td>
                    <td className="text-muted">{ACCOUNT_KINDS[account.kind]}</td>
                    <td className="num"><Amount cents={account.balanceCents} className={clsx("font-semibold", account.balanceCents < 0 && "text-danger")} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {archivedAccounts.length > 0 && (
              <div className="border-t border-border px-5 py-3">
                <button type="button" className="text-[12px] text-muted hover:text-text" onClick={() => setShowArchivedAccounts((value) => !value)}>{showArchivedAccounts ? "Hide" : "Show"} {pluralize(archivedAccounts.length, "archived account")}</button>
                {showArchivedAccounts && archivedAccounts.map((account) => (
                  <button key={account.id} type="button" onClick={() => onEditAccount(account)} className="flex w-full items-center gap-2.5 py-1.5 text-left text-muted">
                    <IconBadge name={account.icon} tone={account.color} size={22} />
                    <span className="flex-1 truncate text-[13px]">{account.name}</span>
                    <Amount cents={account.balanceCents} className="text-[13px]" />
                  </button>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Spending by category" meta={formatMonth(data.currentMonth.month)} actions={<Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={onNewCategory}>Category</Button>}>
            {spending.length === 0 ? <div className="px-5 py-5 text-[12.5px] text-muted">Nothing spent yet this month.</div> : (
              <>
                <div className="px-5 pt-5 pb-4">
                  <BreakdownBar format={formatCents} segments={spending.map((entry) => ({ key: entry.categoryId ?? "none", label: (entry.categoryId ? categories.get(entry.categoryId)?.name : undefined) ?? "Uncategorised", value: entry.spentCents, tone: (entry.categoryId ? categories.get(entry.categoryId)?.color : undefined) ?? "slate" }))} />
                </div>
                <table className="data-table border-t border-border">
                  <thead>
                    <tr><th>Category</th><th className="w-[30%]">Budget used</th><th className="num">Spent</th><th className="num">Share</th></tr>
                  </thead>
                  <tbody>
                    {spending.map((entry) => {
                      const category = entry.categoryId ? categories.get(entry.categoryId) : undefined;
                      const over = entry.limitCents !== null && entry.spentCents > entry.limitCents;
                      return (
                        <tr key={entry.categoryId ?? "none"} className={clsx(category && "row-link")} onClick={() => category && onEditCategory(category)}>
                          <td><CategoryLabel category={category} fallback="Uncategorised" /></td>
                          <td>{entry.limitCents === null ? <span className="text-[12px] text-faint">No budget</span> : <ProgressBar value={entry.spentCents / entry.limitCents} tone={category?.color ?? "slate"} over={over} />}</td>
                          <td className={clsx("num font-medium", over && "text-danger")}>{formatCents(entry.spentCents)}</td>
                          <td className="num text-muted">{data.currentMonth.expenseCents > 0 ? `${Math.round((entry.spentCents / data.currentMonth.expenseCents) * 100)}%` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </Panel>
        </Stack>
        <Stack>
          <Panel title="Cash-flow forecast" meta="next 6 months">
            {projection.data ? (
              <>
                <div className="px-4 pt-4">
                  <ColumnChart
                    axisStep={100}
                    labels={months.map((month) => formatShortMonth(month.month))}
                    titles={months.map((month) => formatMonth(month.month))}
                    height={170}
                    ariaLabel="Expected income and spending for the next six months"
                    format={formatCents}
                    formatAxis={formatCentsCompact}
                    series={[
                      { name: "Expected income", color: "var(--signal)", values: months.map((month) => month.incomeCents) },
                      { name: "Expected spending", color: "var(--series-2)", values: months.map((month) => month.expenseCents) },
                    ]}
                  />
                </div>
                <div className="flex gap-4 px-5 pb-4 text-[11.5px] text-muted">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-signal" />Expected income</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-series-2" />Expected spending</span>
                </div>
                <table className="data-table border-t border-border">
                  <thead>
                    <tr><th>Month</th><th className="num">In</th><th className="num">Out</th><th className="num">Balance</th></tr>
                  </thead>
                  <tbody>
                    {months.map((month) => (
                      <tr key={month.month}>
                        <td>{formatShortMonth(month.month)}</td>
                        <td className="num text-muted">{formatCents(month.incomeCents)}</td>
                        <td className="num text-muted">{formatCents(month.expenseCents)}</td>
                        <td className={clsx("num font-semibold", month.closingCents < 0 && "text-danger")}>{formatCents(month.closingCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-border px-5 py-3 text-[11.5px] text-muted">Recurring items plus your average other spending over the last three months.</p>
              </>
            ) : <div className="h-40" />}
          </Panel>
          <Panel title="Savings goals" meta={data.savingsGoals.length > 0 ? String(data.savingsGoals.length) : undefined}>
            {data.savingsGoals.length === 0 ? (
              <div className="px-5 py-5 text-[12.5px] text-muted">No goals yet. Add one in the Goals tab.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Goal</th><th className="w-[30%]">Progress</th><th className="num">Saved</th><th className="num">Target</th></tr>
                </thead>
                <tbody>
                  {data.savingsGoals.map((goal) => (
                    <tr key={goal.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <IconBadge name={goal.icon} tone={goal.color} size={28} />
                          <span className="truncate font-medium">{goal.name}</span>
                        </div>
                      </td>
                      <td><ProgressBar value={goal.savedCents / goal.targetCents} tone={goal.color} /></td>
                      <td className="num font-medium">{formatCents(goal.savedCents)}</td>
                      <td className="num text-muted">{formatCents(goal.targetCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </Stack>
      </Columns>
    </>
  );
}
