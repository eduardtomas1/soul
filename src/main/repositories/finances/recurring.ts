import type { SoulDatabase } from "../../database/open";
import { newId, nowIso } from "../../database/ids";
import type { IsoDate } from "@shared/contracts/common";
import type { RecurringRule, RecurringRuleInput } from "@shared/contracts/finances";
import { addDays } from "@shared/dates";
import { nextOccurrenceOnOrAfter, occurrencesBetween } from "@shared/recurrence";
import { toRule, type RuleRow } from "./rows";
import type { TransactionsStore } from "./transactions";

export interface RecurringStore {
  readonly list: () => RecurringRule[];
  readonly create: (input: RecurringRuleInput) => RecurringRule;
  readonly update: (id: string, input: RecurringRuleInput) => RecurringRule;
  readonly remove: (id: string) => void;
  readonly postDue: (today: IsoDate, includeManual?: boolean) => number;
  readonly skipDue: (today: IsoDate) => number;
}

function ruleNextDue(rule: RecurringRuleInput, from: IsoDate): IsoDate {
  return nextOccurrenceOnOrAfter(rule, from) ?? addDays(rule.endDate ?? from, 1);
}

export function createRecurringStore(database: SoulDatabase, createTransaction: TransactionsStore["create"]): RecurringStore {
  const selectRules = database.prepare<[], RuleRow>("SELECT * FROM recurring_rules ORDER BY next_due_on, name");
  const selectRule = database.prepare<[string], RuleRow>("SELECT * FROM recurring_rules WHERE id = ?");
  const insertRule = database.prepare<[string, string, string, string | null, number, string, number, string, string | null, string, number, string]>(
    "INSERT INTO recurring_rules (id, name, account_id, category_id, amount_cents, frequency, interval, anchor_date, end_date, next_due_on, auto_post, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const updateRule = database.prepare<[string, string, string | null, number, string, number, string, string | null, string, number, string]>(
    "UPDATE recurring_rules SET name = ?, account_id = ?, category_id = ?, amount_cents = ?, frequency = ?, interval = ?, anchor_date = ?, end_date = ?, next_due_on = ?, auto_post = ? WHERE id = ?",
  );
  const advanceRule = database.prepare<[string, string]>("UPDATE recurring_rules SET next_due_on = ? WHERE id = ?");
  const deleteRule = database.prepare<[string]>("DELETE FROM recurring_rules WHERE id = ?");

  function requireRule(id: string): RecurringRule {
    const row = selectRule.get(id);
    if (!row) throw new Error("Recurring rule not found.");
    return toRule(row);
  }

  const list = (): RecurringRule[] => selectRules.all().map(toRule);

  return {
    list,
    create(input: RecurringRuleInput): RecurringRule {
      const id = newId();
      insertRule.run(id, input.name, input.accountId, input.categoryId, input.amountCents, input.frequency, input.interval, input.anchorDate, input.endDate, ruleNextDue(input, input.anchorDate), input.autoPost ? 1 : 0, nowIso());
      return requireRule(id);
    },
    update(id: string, input: RecurringRuleInput): RecurringRule {
      const existing = requireRule(id);
      const nextDueOn = ruleNextDue(input, existing.nextDueOn < input.anchorDate ? input.anchorDate : existing.nextDueOn);
      updateRule.run(input.name, input.accountId, input.categoryId, input.amountCents, input.frequency, input.interval, input.anchorDate, input.endDate, nextDueOn, input.autoPost ? 1 : 0, id);
      return requireRule(id);
    },
    remove(id: string): void {
      deleteRule.run(id);
    },
    postDue: database.transaction((today: IsoDate, includeManual = false): number => {
      let posted = 0;
      for (const rule of list()) {
        if (!rule.autoPost && !includeManual) continue;
        let due: IsoDate | null = nextOccurrenceOnOrAfter(rule, rule.nextDueOn);
        let guard = 0;
        while (due !== null && due <= today && guard < 500) {
          if (rule.endDate !== null && due > rule.endDate) break;
          createTransaction({ accountId: rule.accountId, categoryId: rule.categoryId, amountCents: rule.amountCents, occurredOn: due, note: rule.name }, { recurringRuleId: rule.id });
          posted += 1;
          due = nextOccurrenceOnOrAfter(rule, addDays(due, 1));
          guard += 1;
        }
        const next = due ?? addDays(rule.endDate ?? today, 1);
        if (next !== rule.nextDueOn) advanceRule.run(next, rule.id);
      }
      return posted;
    }),
    skipDue: database.transaction((today: IsoDate): number => {
      let skipped = 0;
      for (const rule of list()) {
        if (rule.autoPost || rule.nextDueOn > today) continue;
        const first = nextOccurrenceOnOrAfter(rule, rule.nextDueOn);
        if (first !== null && first <= today) skipped += occurrencesBetween(rule, first, today).length;
        const next = nextOccurrenceOnOrAfter(rule, addDays(today, 1)) ?? addDays(rule.endDate ?? today, 1);
        if (next !== rule.nextDueOn) advanceRule.run(next, rule.id);
      }
      return skipped;
    }),
  };
}
