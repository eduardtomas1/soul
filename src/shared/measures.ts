import type { Measure } from "./contracts/measures";

const formatters = new Map<number, Intl.NumberFormat>();

function formatterFor(decimals: number): Intl.NumberFormat {
  let formatter = formatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formatters.set(decimals, formatter);
  }
  return formatter;
}

export function formatMeasureValue(value: number, decimals: number): string {
  return formatterFor(decimals).format(value);
}

export function formatMeasure(value: number, decimals: number, unit: string | null): string {
  const number = formatMeasureValue(value, decimals);
  return unit ? `${number} ${unit}` : number;
}

export function formatMeasureInput(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(".", ",");
}

export function roundMeasure(value: number, decimals: number): number {
  const magnitude = Math.abs(value);
  const text = String(magnitude);
  if (text.includes("e")) return Math.round(value * 10 ** decimals) / 10 ** decimals;
  const rounded = Number(`${Math.round(Number(`${text}e${decimals}`))}e-${decimals}`);
  return value < 0 && rounded !== 0 ? -rounded : rounded;
}

function normalizeSeparators(text: string, decimals: number): string {
  const commas = text.split(",").length - 1;
  const dots = text.split(".").length - 1;
  if (commas > 0 && dots > 0) {
    const decimalMark = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    const grouping = decimalMark === "," ? "." : ",";
    return text.split(grouping).join("").replace(decimalMark, ".");
  }
  if (commas > 1) return text.split(",").join("");
  if (commas === 1 && decimals === 0 && /^-?\d{1,3},\d{3}$/u.test(text)) return text.replace(",", "");
  if (dots > 1) return text.split(".").join("");
  if (commas === 1) return text.replace(",", ".");
  if (dots === 1 && decimals < 3 && /^-?\d{1,3}\.\d{3}$/u.test(text)) return text.replace(".", "");
  return text;
}

export function parseMeasureInput(raw: string, decimals = 3): number | null {
  const cleaned = normalizeSeparators(raw.trim().replace(/\s/gu, ""), decimals);
  if (cleaned.length === 0 || !/^-?\d*(?:\.\d*)?$/u.test(cleaned) || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function changeIsGood(measure: Pick<Measure, "direction">, change: number): boolean | null {
  if (measure.direction === "none" || change === 0) return null;
  return measure.direction === "up" ? change > 0 : change < 0;
}

export function targetGap(measure: Pick<Measure, "direction" | "target">, latest: number): { reached: boolean; gap: number } | null {
  if (measure.target === null) return null;
  if (measure.direction === "up") return { reached: latest >= measure.target, gap: Math.max(0, measure.target - latest) };
  if (measure.direction === "down") return { reached: latest <= measure.target, gap: Math.max(0, latest - measure.target) };
  return { reached: latest === measure.target, gap: Math.abs(latest - measure.target) };
}
