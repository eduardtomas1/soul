import { describe, expect, it } from "vitest";
import { changeIsGood, formatMeasure, formatMeasureInput, parseMeasureInput, roundMeasure, targetGap } from "../src/shared/measures";

describe("measure values", () => {
  it("rounds halves up in decimal, not binary", () => {
    expect(roundMeasure(74.35, 1)).toBe(74.4);
    expect(roundMeasure(1.005, 2)).toBe(1.01);
    expect(roundMeasure(-1.005, 2)).toBe(-1.01);
    expect(roundMeasure(-0.04, 1)).toBe(0);
    expect(Object.is(roundMeasure(-0.04, 1), -0)).toBe(false);
    expect(roundMeasure(8_432.4, 0)).toBe(8_432);
    expect(roundMeasure(0.000_000_4, 2)).toBe(0);
  });

  it("reads comma and dot decimals and rejects anything else", () => {
    expect(parseMeasureInput("74,35")).toBe(74.35);
    expect(parseMeasureInput(" 7.5 ")).toBe(7.5);
    expect(parseMeasureInput("-2")).toBe(-2);
    expect(parseMeasureInput("10 000")).toBe(10_000);
    expect(parseMeasureInput("")).toBeNull();
    expect(parseMeasureInput("-")).toBeNull();
    expect(parseMeasureInput("7,5 kg")).toBeNull();
    expect(parseMeasureInput("1e3")).toBeNull();
  });

  it("reads Spanish thousands separators where a decimal makes no sense", () => {
    expect(parseMeasureInput("8.500", 0)).toBe(8_500);
    expect(parseMeasureInput("10.000", 0)).toBe(10_000);
    expect(parseMeasureInput("1.234,5", 1)).toBe(1_234.5);
    expect(parseMeasureInput("1,234.5", 1)).toBe(1_234.5);
    expect(parseMeasureInput("74.35", 1)).toBe(74.35);
    expect(parseMeasureInput("7.5", 0)).toBe(7.5);
    expect(parseMeasureInput("1.005", 3)).toBe(1.005);
    expect(parseMeasureInput("1.234.567", 0)).toBe(1_234_567);
    expect(parseMeasureInput("8,500", 0)).toBe(8_500);
    expect(parseMeasureInput("8,500", 1)).toBe(8.5);
  });

  it("colours a change by the direction the person chose, even past the target", () => {
    const steps = { direction: "up" as const, target: 10_000 };
    const weight = { direction: "down" as const, target: 72 };
    const pulse = { direction: "none" as const, target: null };
    expect(changeIsGood(steps, 900)).toBe(true);
    expect(changeIsGood(steps, -900)).toBe(false);
    expect(changeIsGood(weight, -0.7)).toBe(true);
    expect(changeIsGood(pulse, 3)).toBeNull();
    expect(changeIsGood(steps, 0)).toBeNull();
    expect(targetGap(steps, 12_000)).toEqual({ reached: true, gap: 0 });
    expect(targetGap(steps, 8_500)).toEqual({ reached: false, gap: 1_500 });
    expect(targetGap(weight, 74.1)?.reached).toBe(false);
    expect(targetGap(weight, 71.5)).toEqual({ reached: true, gap: 0 });
    expect(targetGap(pulse, 60)).toBeNull();
  });

  it("formats values with their unit and precision", () => {
    expect(formatMeasure(74.1, 1, "kg")).toBe("74,1 kg");
    expect(formatMeasure(11_209, 0, null)).toBe("11.209");
    expect(formatMeasureInput(11_209, 0)).toBe("11209");
    expect(formatMeasureInput(7.25, 2)).toBe("7,25");
  });
});
