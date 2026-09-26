import type { IsoDate } from "@shared/contracts/common";
import { parseIsoDate, todayIso, addDays } from "@shared/dates";

const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const weekdayDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const weekdayDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" });
const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const shortMonth = new Intl.DateTimeFormat("en-GB", { month: "short" });
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const relativeDay = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatLongDate(date: IsoDate): string {
  return longDate.format(parseIsoDate(date));
}

export function formatShortDate(date: IsoDate): string {
  return shortDate.format(parseIsoDate(date));
}

export function formatWeekdayDate(date: IsoDate): string {
  return weekdayDate.format(parseIsoDate(date));
}

export function formatWeekdayDay(date: IsoDate): string {
  return weekdayDay.format(parseIsoDate(date));
}

export function formatDecimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

export function formatSignedDecimal(value: number, digits = 1): string {
  const text = formatDecimal(Math.abs(value), digits);
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text;
}

export function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatMonth(month: string): string {
  return monthLabel.format(new Date(`${month}-01T00:00:00`));
}

export function formatShortMonth(month: string): string {
  return shortMonth.format(new Date(`${month}-01T00:00:00`));
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return `${shortDate.format(date)}, ${time.format(date)}`;
}

export function formatRelativeDay(date: IsoDate, today: IsoDate = todayIso()): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  const diff = Math.round((parseIsoDate(date).getTime() - parseIsoDate(today).getTime()) / 86_400_000);
  if (Math.abs(diff) < 7) return relativeDay.format(diff, "day");
  return shortDate.format(parseIsoDate(date));
}

export const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function describeWeekdays(weekdays: readonly number[]): string {
  if (weekdays.length === 7) return "Every day";
  if (weekdays.length === 5 && !weekdays.includes(5) && !weekdays.includes(6)) return "Weekdays";
  if (weekdays.length === 2 && weekdays.includes(5) && weekdays.includes(6)) return "Weekends";
  return [...weekdays].sort((a, b) => a - b).map((day) => WEEKDAY_SHORT[day]).join(", ");
}
