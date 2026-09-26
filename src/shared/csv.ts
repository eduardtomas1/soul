import type { IsoDate } from "./contracts/common";
import type { CsvColumnRole, CsvMapping } from "./contracts/finances";
import { parseEuroInput } from "./money";

export interface ParsedCsv {
  readonly delimiter: string;
  readonly rows: string[][];
}

export function detectDelimiter(sample: string): string {
  const candidates = [",", ";", "\t", "|"];
  const firstLines = sample.split(/\r?\n/u).slice(0, 5).filter((line) => line.length > 0);
  let best = ",";
  let bestScore = -1;
  for (const candidate of candidates) {
    const counts = firstLines.map((line) => line.split(candidate).length - 1);
    const minimum = Math.min(...counts);
    const consistent = counts.every((count) => count === counts[0]);
    const score = minimum * (consistent ? 2 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

export function parseCsv(text: string, delimiter?: string): ParsedCsv {
  const content = text.replace(/^﻿/u, "");
  const separator = delimiter ?? detectDelimiter(content);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index] as string;
    if (quoted) {
      if (char === "\"") {
        if (content[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === "\"" && field.trim().length === 0) {
      quoted = true;
      field = "";
    } else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && content[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return { delimiter: separator, rows };
}

export function suggestRoles(headers: readonly string[]): CsvColumnRole[] {
  return headers.map((header) => {
    const name = header.trim().toLowerCase();
    if (/fecha|date|datum|data\b/u.test(name)) return "date";
    if (/debit|débito|debe|cargo|withdraw|salida/u.test(name)) return "debit";
    if (/credit|crédito|haber|abono|deposit|entrada/u.test(name)) return "credit";
    if (/importe|amount|monto|cantidad|valor|betrag|montant/u.test(name)) return "amount";
    if (/concepto|descrip|memo|detalle|note|narrative|text|beneficiario|payee/u.test(name)) return "note";
    return "ignore";
  });
}

export function parseCsvDate(raw: string, format: CsvMapping["dateFormat"]): IsoDate | null {
  const value = raw.trim();
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/u.exec(value) ?? /^(\d{4})(\d{2})(\d{2})$/u.exec(value);
  if (iso) return buildDate(iso[1], iso[2], iso[3]);
  const parts = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/u.exec(value);
  if (!parts) return null;
  const [, first, second, yearRaw] = parts as unknown as [string, string, string, string];
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  if (format === "mdy") return buildDate(year, first, second);
  if (format === "dmy") return buildDate(year, second, first);
  if (Number(first) > 12) return buildDate(year, second, first);
  if (Number(second) > 12) return buildDate(year, first, second);
  return buildDate(year, second, first);
}

function buildDate(year: string | undefined, month: string | undefined, day: string | undefined): IsoDate | null {
  if (!year || !month || !day) return null;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) return null;
  const candidate = `${year}-${String(monthNumber).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
  const check = new Date(`${candidate}T00:00:00`);
  if (Number.isNaN(check.getTime()) || check.getDate() !== dayNumber) return null;
  return candidate;
}

export interface MappedCsvRow {
  readonly occurredOn: IsoDate | null;
  readonly amountCents: number | null;
  readonly note: string;
  readonly error: string | null;
}

export function mapCsvRow(row: readonly string[], mapping: CsvMapping): MappedCsvRow {
  let occurredOn: IsoDate | null = null;
  let amountCents: number | null = null;
  let debit: number | null = null;
  let credit: number | null = null;
  const notes: string[] = [];
  mapping.roles.forEach((role, index) => {
    const cell = row[index] ?? "";
    switch (role) {
      case "date":
        occurredOn = parseCsvDate(cell, mapping.dateFormat);
        break;
      case "amount":
        amountCents = parseEuroInput(cell);
        break;
      case "debit":
        debit = parseEuroInput(cell);
        break;
      case "credit":
        credit = parseEuroInput(cell);
        break;
      case "note":
        if (cell.trim().length > 0) notes.push(cell.trim());
        break;
      case "ignore":
        break;
    }
  });
  if (amountCents === null && (debit !== null || credit !== null)) {
    amountCents = (credit ?? 0) - Math.abs(debit ?? 0);
  }
  if (amountCents !== null && mapping.invertSign) amountCents = -amountCents;
  const error = occurredOn === null ? "Unreadable date" : amountCents === null ? "Unreadable amount" : null;
  return { occurredOn, amountCents, note: notes.join(" · ").slice(0, 2_000), error };
}
