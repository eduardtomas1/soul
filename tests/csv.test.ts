import { describe, expect, it } from "vitest";
import { detectDelimiter, mapCsvRow, parseCsv, parseCsvDate, suggestRoles } from "../src/shared/csv";
import { parseEuroInput } from "../src/shared/money";

describe("csv import", () => {
  it("detects semicolons and quoted fields", () => {
    const parsed = parseCsv('Fecha;Concepto;Importe\n03/03/2026;"Mercado; fruta";-25,50\n');
    expect(parsed.delimiter).toBe(";");
    expect(parsed.rows[1]).toEqual(["03/03/2026", "Mercado; fruta", "-25,50"]);
    expect(suggestRoles(parsed.rows[0]!)).toEqual(["date", "note", "amount"]);
  });

  it("maps European amounts and dates", () => {
    expect(parseEuroInput("-1.234,56")).toBe(-123_456);
    expect(parseEuroInput("1234.5")).toBe(123_450);
    expect(parseCsvDate("03/03/2026", "auto")).toBe("2026-03-03");
    expect(parseCsvDate("2026-03-03", "auto")).toBe("2026-03-03");
    expect(parseCsvDate("13/03/2026", "auto")).toBe("2026-03-13");
    const row = mapCsvRow(["03/03/2026", "Market", "", "12,00"], { roles: ["date", "note", "credit", "debit"], dateFormat: "dmy", hasHeader: true, invertSign: false });
    expect(row.amountCents).toBe(-1_200);
    expect(row.error).toBeNull();
  });

  it("keeps quotes that appear in the middle of a field", () => {
    const parsed = parseCsv('Date,Note,Amount\n2026-03-03,27" monitor,-199.00\n2026-03-04,"Said ""hi""",5.00\n');
    expect(parsed.rows[1]).toEqual(["2026-03-03", '27" monitor', "-199.00"]);
    expect(parsed.rows[2]).toEqual(["2026-03-04", 'Said "hi"', "5.00"]);
    expect(parsed.rows).toHaveLength(3);
  });

  it("reads quoted fields that follow a space after the separator", () => {
    const parsed = parseCsv('Date, Note, Amount\n2026-03-03, "Pago, 25, tienda", -3.50\n');
    expect(parsed.rows[1]).toEqual(["2026-03-03", "Pago, 25, tienda", " -3.50"]);
    const semicolons = parseCsv('Fecha; Concepto; Importe\n03/03/2026; "Compra; tienda"; -12,50\n');
    expect(semicolons.rows[1]).toEqual(["03/03/2026", "Compra; tienda", " -12,50"]);
  });

  it("handles CRLF, a byte order mark and blank lines", () => {
    const parsed = parseCsv("﻿Date\tAmount\r\n\r\n2026-03-03\t-5\r\n");
    expect(parsed.delimiter).toBe("\t");
    expect(parsed.rows).toEqual([["Date", "Amount"], ["2026-03-03", "-5"]]);
    expect(detectDelimiter("a|b|c\n1|2|3")).toBe("|");
  });

  it("reads unambiguous dates whatever format is chosen", () => {
    expect(parseCsvDate("2026-03-04", "dmy")).toBe("2026-03-04");
    expect(parseCsvDate("2026/3/4", "mdy")).toBe("2026-03-04");
    expect(parseCsvDate("20260304", "auto")).toBe("2026-03-04");
    expect(parseCsvDate("03/04/2026", "mdy")).toBe("2026-03-04");
    expect(parseCsvDate("03/04/26", "dmy")).toBe("2026-04-03");
    expect(parseCsvDate("31/02/2026", "dmy")).toBeNull();
    expect(parseCsvDate("yesterday", "auto")).toBeNull();
  });

  it("flips signs and reports unreadable rows", () => {
    const mapping = { roles: ["date", "amount", "note"] as const, dateFormat: "auto" as const, hasHeader: false, invertSign: true };
    expect(mapCsvRow(["2026-03-03", "25,00", "Refund"], { ...mapping, roles: [...mapping.roles] })).toMatchObject({ amountCents: -2_500, note: "Refund", error: null });
    expect(mapCsvRow(["soon", "25,00", ""], { ...mapping, roles: [...mapping.roles] }).error).toBe("Unreadable date");
    expect(mapCsvRow(["2026-03-03", "n/a", ""], { ...mapping, roles: [...mapping.roles] }).error).toBe("Unreadable amount");
  });
});
