import { Bank, FileCsv, UploadSimple } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useState } from "react";
import type { Account, Category, CsvColumnRole, CsvImportRow, CsvMapping, CsvPreview } from "@shared/contracts/finances";
import { formatCents } from "@shared/money";
import { invoke } from "@/lib/bridge";
import { pluralize } from "@/lib/format";
import { useToasts } from "@/lib/toasts";
import { Button, Card, EmptyState, Field, InlineError, Select, Toggle } from "@/components/primitives";

const ROLE_LABELS: Record<CsvColumnRole, string> = { date: "Date", amount: "Amount", debit: "Debit (money out)", credit: "Credit (money in)", note: "Note", ignore: "Ignore" };

export function ImportTab({ accounts, categories, onNewAccount }: { accounts: readonly Account[]; categories: readonly Category[]; onNewAccount: () => void }) {
  const live = accounts.filter((account) => account.archivedAt === null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [accountId, setAccountId] = useState(live[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [rows, setRows] = useState<CsvImportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { push } = useToasts();

  const pick = async () => {
    setError(null);
    const path = await invoke("finances.csv.pick");
    if (!path) return;
    setBusy(true);
    try {
      const loaded = await invoke("finances.csv.preview", { filePath: path });
      setFilePath(path);
      setPreview(loaded);
      setMapping({ roles: loaded.suggestedRoles, dateFormat: "auto", hasHeader: true, invertSign: false });
      setRows(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read the file.");
    } finally {
      setBusy(false);
    }
  };

  const request = () => (filePath && mapping && accountId ? { filePath, accountId, mapping, categoryId: categoryId || null, skipDuplicates } : null);

  const dryRun = async () => {
    const payload = request();
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      setRows(await invoke("finances.csv.dryRun", payload));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read the file.");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    const payload = request();
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const result = await invoke("finances.csv.import", payload);
      const notes = [
        result.skipped > 0 ? `${pluralize(result.skipped, "duplicate")} skipped` : null,
        result.failed > 0 ? `${pluralize(result.failed, "row")} unreadable` : null,
      ].filter((note) => note !== null);
      push({ title: `Imported ${pluralize(result.imported, "transaction")}`, description: notes.length > 0 ? `${notes.join(", ")}.` : undefined, tone: "success" });
      setFilePath(null);
      setPreview(null);
      setMapping(null);
      setRows(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  if (live.length === 0) {
    return <Card><EmptyState icon={<Bank size={22} />} title="Add an account first" description="Imported transactions need an account to land in." action={<Button variant="primary" onClick={onNewAccount}>Create an account</Button>} /></Card>;
  }

  const mappedRoles = mapping?.roles ?? [];
  const hasDate = mappedRoles.includes("date");
  const hasAmount = mappedRoles.includes("amount") || mappedRoles.includes("debit") || mappedRoles.includes("credit");
  const readyRows = rows?.filter((row) => row.error === null) ?? [];
  const duplicates = readyRows.filter((row) => row.duplicate).length;
  const willImport = readyRows.length - (skipDuplicates ? duplicates : 0);

  return (
    <div className="flex flex-col gap-4">
      {!preview ? (
        <Card><EmptyState icon={<FileCsv size={22} />} title="Import a bank statement" description="Export a CSV from your bank, then map its columns. Soul detects the separator, dates and European amounts and skips rows you already have." action={<Button variant="primary" icon={<UploadSimple size={15} />} onClick={() => void pick()} loading={busy}>Choose a CSV file</Button>} /></Card>
      ) : (
        <>
          <Card className="p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <FileCsv size={22} weight="duotone" className="text-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium truncate">{filePath}</div>
                <div className="text-[12px] text-muted">{pluralize(preview.totalRows, "row")} · separator “{preview.delimiter === "\t" ? "tab" : preview.delimiter}”</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void pick()}>Choose another</Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Into account"><Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{live.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></Field>
              <Field label="Default category"><Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">None</option>{categories.filter((category) => category.archivedAt === null).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>
              <Field label="Date format"><Select value={mapping?.dateFormat ?? "auto"} onChange={(event) => mapping && setMapping({ ...mapping, dateFormat: event.target.value as CsvMapping["dateFormat"] })}><option value="auto">Detect</option><option value="dmy">Day / month / year</option><option value="mdy">Month / day / year</option><option value="ymd">Year-month-day</option></Select></Field>
            </div>
            <div className="flex gap-6">
              <Toggle checked={mapping?.hasHeader ?? true} onChange={(hasHeader) => mapping && setMapping({ ...mapping, hasHeader })} label="First row is a header" />
              <Toggle checked={mapping?.invertSign ?? false} onChange={(invertSign) => mapping && setMapping({ ...mapping, invertSign })} label="Flip signs" description="If the bank lists spending as positive." />
              <Toggle checked={skipDuplicates} onChange={setSkipDuplicates} label="Skip duplicates" description="Same account, date, amount and note." />
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-surface-2">
                    {preview.headers.map((header, index) => (
                      <th key={index} className="px-3 py-2 text-left font-medium align-top min-w-[140px]">
                        <div className="text-[11px] text-faint truncate mb-1">{header || `Column ${index + 1}`}</div>
                        <Select value={mappedRoles[index] ?? "ignore"} onChange={(event) => mapping && setMapping({ ...mapping, roles: mapping.roles.map((role, position) => (position === index ? (event.target.value as CsvColumnRole) : role)) })} className="h-7 text-[12px]">
                          {(Object.keys(ROLE_LABELS) as CsvColumnRole[]).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                        </Select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 6).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-border">
                      {preview.headers.map((_, index) => <td key={index} className={clsx("px-3 py-1.5 truncate max-w-[220px]", mappedRoles[index] === "ignore" && "text-faint")}>{row[index] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="flex items-center gap-3">
            <Button onClick={() => void dryRun()} disabled={!hasDate || !hasAmount || !accountId} loading={busy}>Check rows</Button>
            {rows && <span className="text-[13px] text-muted">{readyRows.length} readable · {pluralize(duplicates, "duplicate")} · {rows.length - readyRows.length} unreadable</span>}
            {rows && <Button variant="primary" className="ml-auto" onClick={() => void run()} disabled={willImport <= 0} loading={busy}>Import {pluralize(willImport, "transaction")}</Button>}
          </div>
          {(!hasDate || !hasAmount) && <p className="text-[12.5px] text-muted">Map a date column and either an amount column or debit and credit columns.</p>}
          {rows && (
            <Card className="divide-y divide-border max-h-[320px] overflow-y-auto">
              {rows.slice(0, 200).map((row, index) => (
                <div key={index} className={clsx("flex items-center gap-3 px-5 py-3 text-[12.5px]", row.error && "text-danger", row.duplicate && "opacity-60")}>
                  <span className="w-[90px] tabular-nums">{row.occurredOn ?? "—"}</span>
                  <span className="flex-1 truncate">{row.note || "(no note)"}</span>
                  <span className="text-[11px] text-faint w-[80px]">{row.error ?? (row.duplicate ? "duplicate" : "")}</span>
                  <span className="tabular-nums w-[110px] text-right">{row.amountCents === null ? "—" : formatCents(row.amountCents)}</span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
      <InlineError message={error} />
    </div>
  );
}
