import { ArrowsLeftRight, Bank, Plus } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { Account, Category } from "@shared/contracts/finances";
import { formatCents } from "@shared/money";
import { useQuery } from "@/lib/query";
import { useNavigation } from "@/lib/navigation";
import { pluralize } from "@/lib/format";
import { Button, EmptyState, Panel, Skeleton, Tabs } from "@/components/primitives";
import { Page } from "@/features/shell/page";
import { AccountEditor } from "./editors/account-editor";
import { CategoryEditor } from "./editors/category-editor";
import { TransactionEditor } from "./editors/transaction-editor";
import { TransferEditor } from "./editors/transfer-editor";
import { TransactionsTab } from "./transactions-tab";
import { RecurringTab } from "./recurring-tab";
import { BudgetsTab } from "./budgets-tab";
import { GoalsTab } from "./goals-tab";
import { ImportTab } from "./import-tab";
import { OverviewTab } from "./overview-tab";

type Tab = "overview" | "transactions" | "recurring" | "budgets" | "goals" | "import";
const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "transactions", label: "Transactions" },
  { value: "recurring", label: "Recurring" },
  { value: "budgets", label: "Budgets" },
  { value: "goals", label: "Goals" },
  { value: "import", label: "Import" },
];

export function FinancesView() {
  const { route } = useNavigation();
  const overview = useQuery("finances.overview", undefined, ["finances"]);
  const [tab, setTab] = useState<Tab>(TABS.some((entry) => entry.value === route.tab) ? (route.tab as Tab) : "overview");
  const [editor, setEditor] = useState<{ kind: "transaction" | "transfer" | "account" | "category"; account?: Account | null; category?: Category | null } | null>(route.focusId === "new" && route.tab === "transactions" ? { kind: "transaction" } : null);

  const data = overview.data;
  const liveAccounts = useMemo(() => (data?.accounts ?? []).filter((account) => account.archivedAt === null), [data]);

  return (
    <Page
      title="Finance"
      subtitle={data ? `${formatCents(data.netWorthCents)} net worth · ${pluralize(liveAccounts.length, "account")}` : "Accounts, spending, budgets and forecasts."}
      actions={
        <>
          <Button icon={<ArrowsLeftRight size={14} />} onClick={() => setEditor({ kind: "transfer" })} disabled={liveAccounts.length < 2}>Transfer</Button>
          <Button variant="primary" icon={<Plus size={14} weight="bold" />} onClick={() => setEditor({ kind: "transaction" })} disabled={liveAccounts.length === 0}>Add transaction</Button>
        </>
      }
      tabs={<Tabs value={tab} onChange={setTab} options={TABS} />}
      wide
    >
      {data && liveAccounts.length === 0 && tab !== "import" ? (
        <Panel><EmptyState icon={<Bank size={22} />} title="Add your first account" description="An account is where money is kept: a bank account, cash, a savings pot. Everything else builds on it." action={<Button variant="primary" onClick={() => setEditor({ kind: "account", account: null })}>Create an account</Button>} /></Panel>
      ) : (
        <>
          {!data && <Skeleton height={260} />}
          {tab === "overview" && data && <OverviewTab data={data} onEditAccount={(account) => setEditor({ kind: "account", account })} onNewAccount={() => setEditor({ kind: "account", account: null })} onEditCategory={(category) => setEditor({ kind: "category", category })} onNewCategory={() => setEditor({ kind: "category", category: null })} />}
          {tab === "transactions" && data && <TransactionsTab accounts={data.accounts} categories={data.categories} />}
          {tab === "recurring" && data && <RecurringTab accounts={data.accounts} categories={data.categories} rules={data.recurringRules} openNew={route.focusId === "new" && route.tab === "recurring"} />}
          {tab === "budgets" && data && <BudgetsTab data={data} onEditCategory={(category) => setEditor({ kind: "category", category })} onNewCategory={() => setEditor({ kind: "category", category: null })} />}
          {tab === "goals" && data && <GoalsTab goals={data.savingsGoals} />}
          {tab === "import" && data && <ImportTab accounts={data.accounts} categories={data.categories} onNewAccount={() => setEditor({ kind: "account", account: null })} />}
        </>
      )}
      {editor?.kind === "transaction" && data && <TransactionEditor transaction={null} accounts={data.accounts} categories={data.categories} open onClose={() => setEditor(null)} />}
      {editor?.kind === "transfer" && data && <TransferEditor accounts={data.accounts} open onClose={() => setEditor(null)} />}
      {editor?.kind === "account" && <AccountEditor key={editor.account?.id ?? "new"} account={editor.account ?? null} open onClose={() => setEditor(null)} />}
      {editor?.kind === "category" && <CategoryEditor key={editor.category?.id ?? "new"} category={editor.category ?? null} open onClose={() => setEditor(null)} />}
    </Page>
  );
}
