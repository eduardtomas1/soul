const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const compactFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
});

export function formatCents(cents: number): string {
  return euroFormatter.format(cents / 100);
}

export function formatCentsCompact(cents: number): string {
  return compactFormatter.format(Math.round(cents / 100));
}

export function formatSignedCents(cents: number): string {
  const formatted = formatCents(Math.abs(cents));
  if (cents === 0) return formatted;
  return cents < 0 ? `−${formatted}` : `+${formatted}`;
}

function withSignFirst(value: string): string {
  const unwrapped = /^\((.+)\)$/u.exec(value);
  if (unwrapped?.[1]) return `-${unwrapped[1]}`;
  if (value.endsWith("-") && !value.startsWith("-")) return `-${value.slice(0, -1)}`;
  return value.startsWith("+") ? value.slice(1) : value;
}

export function parseEuroInput(raw: string): number | null {
  const cleaned = withSignFirst(raw.trim().replace(/\s|€|eur/giu, "").replace(/[−–]/gu, "-"));
  if (cleaned.length === 0) return null;
  const normalized = /^-?[1-9]\d{0,2}(?:\.\d{3})+$/u.test(cleaned)
    ? cleaned.replace(/\./gu, "")
    : cleaned.includes(",") && !/\.\d{1,2}$/u.test(cleaned) && !/^-?[1-9]\d{0,2}(?:,\d{3})+$/u.test(cleaned)
      ? cleaned.replace(/\./gu, "").replace(",", ".")
      : cleaned.replace(/,/gu, "");
  if (!/^-?\d+(\.\d{1,2})?$/u.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
