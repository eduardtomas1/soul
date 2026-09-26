import { describe, expect, it } from "vitest";
import { formatCents, formatSignedCents, parseEuroInput } from "../src/shared/money";

describe("euro amounts", () => {
  it("reads European and English notation", () => {
    expect(parseEuroInput("12,5")).toBe(1_250);
    expect(parseEuroInput("-1.234,56")).toBe(-123_456);
    expect(parseEuroInput("1,234.56")).toBe(123_456);
    expect(parseEuroInput("1.234.567,89")).toBe(123_456_789);
    expect(parseEuroInput("1234.5")).toBe(123_450);
  });

  it("reads thousands written without decimals", () => {
    expect(parseEuroInput("1.234")).toBe(123_400);
    expect(parseEuroInput("12.345")).toBe(1_234_500);
    expect(parseEuroInput("1,234")).toBe(123_400);
    expect(parseEuroInput("0.123")).toBeNull();
  });

  it("understands the signs and symbols banks export", () => {
    expect(parseEuroInput("+1.234,56")).toBe(123_456);
    expect(parseEuroInput("−25,50")).toBe(-2_550);
    expect(parseEuroInput("12,50-")).toBe(-1_250);
    expect(parseEuroInput("(12.50)")).toBe(-1_250);
    expect(parseEuroInput("25,50 EUR")).toBe(2_550);
    expect(parseEuroInput("€ 3,00")).toBe(300);
    expect(parseEuroInput("1 234,56")).toBe(123_456);
  });

  it("rejects what is not an amount", () => {
    expect(parseEuroInput("")).toBeNull();
    expect(parseEuroInput("-")).toBeNull();
    expect(parseEuroInput("abc")).toBeNull();
    expect(parseEuroInput("1,2,3")).toBeNull();
    expect(parseEuroInput("12.345,678")).toBeNull();
  });

  it("formats every amount with the same grouping", () => {
    const euro = (text: string) => text.replace(" €", " €");
    expect(formatCents(123_456)).toBe(euro("1.234,56 €"));
    expect(formatCents(1_234_567)).toBe(euro("12.345,67 €"));
    expect(formatCents(-9_900)).toBe(euro("-99,00 €"));
    expect(formatSignedCents(-150)).toBe(euro("−1,50 €"));
    expect(formatSignedCents(150)).toBe(euro("+1,50 €"));
    expect(formatSignedCents(0)).toBe(euro("0,00 €"));
  });
});
