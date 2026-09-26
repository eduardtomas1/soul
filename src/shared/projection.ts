import type { IsoDate, IsoMonth } from "./contracts/common";
import type { Projection, ProjectionItem, ProjectionMonth, RecurringRule } from "./contracts/finances";
import { addMonthsToMonth, daysBetween, firstDayOfMonth, lastDayOfMonth, monthOf } from "./dates";
import { occurrencesBetween } from "./recurrence";

export interface ProjectionInput {
  readonly startingCents: number;
  readonly from: IsoDate;
  readonly months: number;
  readonly rules: readonly RecurringRule[];
  readonly averageDiscretionaryExpenseCents?: number;
}

export function projectCashFlow(input: ProjectionInput): Projection {
  const months: ProjectionMonth[] = [];
  let running = input.startingCents;
  let month: IsoMonth = monthOf(input.from);
  for (let index = 0; index < input.months; index += 1) {
    const rangeStart = index === 0 ? input.from : firstDayOfMonth(month);
    const rangeEnd = lastDayOfMonth(month);
    const items: ProjectionItem[] = [];
    for (const rule of input.rules) {
      for (const dueOn of occurrencesBetween(rule, rangeStart, rangeEnd)) {
        if (dueOn < rule.nextDueOn) continue;
        items.push({ ruleId: rule.id, name: rule.name, dueOn, amountCents: rule.amountCents });
      }
    }
    items.sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0));
    let incomeCents = 0;
    let expenseCents = 0;
    for (const item of items) {
      if (item.amountCents >= 0) incomeCents += item.amountCents;
      else expenseCents += -item.amountCents;
    }
    if (input.averageDiscretionaryExpenseCents !== undefined) {
      const remainingShare = (daysBetween(rangeStart, rangeEnd) + 1) / (daysBetween(firstDayOfMonth(month), rangeEnd) + 1);
      expenseCents += Math.round(input.averageDiscretionaryExpenseCents * remainingShare);
    }
    const openingCents = running;
    running = openingCents + incomeCents - expenseCents;
    months.push({ month, openingCents, incomeCents, expenseCents, closingCents: running, items });
    month = addMonthsToMonth(month, 1);
  }
  return { startingCents: input.startingCents, months };
}
