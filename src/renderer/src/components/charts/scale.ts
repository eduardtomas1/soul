export interface Domain {
  readonly min: number;
  readonly max: number;
  readonly ticks: readonly number[];
}

function niceStep(range: number, count: number): number {
  const rough = range / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

export function niceDomain(values: readonly number[], count = 4, includeZero = false, minStep = 0): Domain {
  let min = values.length > 0 ? Math.min(...values) : 0;
  let max = values.length > 0 ? Math.max(...values) : 1;
  if (includeZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min = includeZero && min >= 0 ? 0 : min - pad;
    max += pad;
  }
  const step = Math.max(niceStep(max - min, count), minStep);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = niceMin; value <= niceMax + step / 2; value += step) ticks.push(Number(value.toFixed(10)) + 0);
  return { min: niceMin + 0, max: niceMax + 0, ticks };
}

export function labelIndexes(count: number, wanted: number): number[] {
  if (count <= wanted) return Array.from({ length: count }, (_, index) => index);
  const step = Math.ceil((count - 1) / (wanted - 1));
  const indexes: number[] = [];
  for (let index = 0; index < count - step / 2; index += step) indexes.push(index);
  indexes.push(count - 1);
  return indexes;
}

export function axisWidth(labels: readonly string[]): number {
  return Math.max(28, Math.round(Math.max(0, ...labels.map((label) => label.length)) * 6.2) + 12);
}
