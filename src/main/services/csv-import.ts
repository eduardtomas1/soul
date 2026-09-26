import { readFile, stat } from "node:fs/promises";
import type { CsvImportRequest, CsvImportResult, CsvImportRow, CsvPreview, TransactionInput } from "@shared/contracts/finances";
import { mapCsvRow, parseCsv, suggestRoles } from "@shared/csv";
import type { FinancesRepository } from "../repositories/finances";

const MAX_CSV_BYTES = 20 * 1024 * 1024;

async function readCsv(filePath: string): Promise<string> {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error("That path is not a file.");
  if (info.size > MAX_CSV_BYTES) throw new Error("This file is larger than 20 MB.");
  const buffer = await readFile(filePath);
  const utf8 = buffer.toString("utf8");
  return utf8.includes("�") ? buffer.toString("latin1") : utf8;
}

export async function previewCsv(filePath: string): Promise<CsvPreview> {
  const parsed = parseCsv(await readCsv(filePath));
  const headers = parsed.rows[0] ?? [];
  return {
    delimiter: parsed.delimiter,
    headers,
    rows: parsed.rows.slice(1, 21),
    totalRows: Math.max(0, parsed.rows.length - 1),
    suggestedRoles: suggestRoles(headers),
  };
}

export async function dryRunCsv(request: CsvImportRequest, finances: FinancesRepository): Promise<CsvImportRow[]> {
  const parsed = parseCsv(await readCsv(request.filePath));
  const rows = request.mapping.hasHeader ? parsed.rows.slice(1) : parsed.rows;
  return rows.map((row) => {
    const mapped = mapCsvRow(row, request.mapping);
    const duplicate = mapped.occurredOn !== null && mapped.amountCents !== null
      && finances.transactions.exists(request.accountId, mapped.occurredOn, mapped.amountCents, mapped.note);
    return { ...mapped, duplicate };
  });
}

export async function importCsv(request: CsvImportRequest, finances: FinancesRepository): Promise<CsvImportResult> {
  const rows = await dryRunCsv(request, finances);
  const inserts: TransactionInput[] = [];
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.error !== null || row.occurredOn === null || row.amountCents === null) {
      failed += 1;
      continue;
    }
    if (row.duplicate && request.skipDuplicates) {
      skipped += 1;
      continue;
    }
    inserts.push({
      accountId: request.accountId,
      categoryId: request.categoryId,
      amountCents: row.amountCents,
      occurredOn: row.occurredOn,
      note: row.note,
    });
  }
  const imported = finances.transactions.insertMany(inserts);
  return { imported, skipped, failed };
}
