import type { IsoDate, IsoMonth, Weekday } from "./contracts/common";

const DAY_MS = 86_400_000;

export function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

export function localDateOf(timestamp: string): IsoDate {
  return toIsoDate(new Date(timestamp));
}

export function parseIsoDate(value: IsoDate): Date {
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function addMonths(value: IsoDate, months: number): IsoDate {
  const date = parseIsoDate(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = daysInMonth(date.getFullYear(), date.getMonth());
  date.setDate(Math.min(day, lastDay));
  return toIsoDate(date);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = Date.UTC(...isoParts(from));
  const b = Date.UTC(...isoParts(to));
  return Math.round((b - a) / DAY_MS);
}

function isoParts(value: IsoDate): [number, number, number] {
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return [year, month - 1, day];
}

export function weekdayOf(value: IsoDate): Weekday {
  const jsDay = parseIsoDate(value).getDay();
  return ((jsDay + 6) % 7) as Weekday;
}

export function startOfWeek(value: IsoDate): IsoDate {
  return addDays(value, -weekdayOf(value));
}

export function monthOf(value: IsoDate): IsoMonth {
  return value.slice(0, 7);
}

export function firstDayOfMonth(month: IsoMonth): IsoDate {
  return `${month}-01`;
}

export function lastDayOfMonth(month: IsoMonth): IsoDate {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return `${month}-${String(daysInMonth(year, monthNumber - 1)).padStart(2, "0")}`;
}

export function addMonthsToMonth(month: IsoMonth, months: number): IsoMonth {
  return monthOf(addMonths(firstDayOfMonth(month), months));
}

export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const total = daysBetween(from, to);
  const days: IsoDate[] = [];
  for (let offset = 0; offset <= total; offset += 1) days.push(addDays(from, offset));
  return days;
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function weekdaysToMask(weekdays: readonly Weekday[]): number {
  return weekdays.reduce((mask, day) => mask | (1 << day), 0);
}

export function maskToWeekdays(mask: number): Weekday[] {
  const days: Weekday[] = [];
  for (let day = 0; day < 7; day += 1) if (mask & (1 << day)) days.push(day as Weekday);
  return days;
}

export const EVERY_DAY_MASK = 0b1111111;

export function isScheduledOn(mask: number, date: IsoDate): boolean {
  return (mask & (1 << weekdayOf(date))) !== 0;
}

export function localTimestamp(date: IsoDate, clock: string): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const [hours, minutes] = clock.split(":").map(Number) as [number, number];
  return new Date(year, month - 1, day, hours, minutes).getTime();
}

export function minutesOfClock(time: string): number {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  return hours * 60 + minutes;
}

export function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
