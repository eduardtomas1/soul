import { describe, expect, it } from "vitest";
import { projectCashFlow } from "../src/shared/projection";
import { nthOccurrence, occurrencesBetween, nextOccurrenceOnOrAfter } from "../src/shared/recurrence";
import type { RecurringRule } from "../src/shared/contracts/finances";

const salary: RecurringRule = {
  id: "salary",
  name: "Salary",
  accountId: "a",
  categoryId: null,
  amountCents: 250_000,
  frequency: "monthly",
  interval: 1,
  anchorDate: "2026-01-28",
  endDate: null,
  nextDueOn: "2026-03-28",
  autoPost: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const rent: RecurringRule = { ...salary, id: "rent", name: "Rent", amountCents: -95_000, anchorDate: "2026-01-01", nextDueOn: "2026-04-01" };

describe("recurrence", () => {
  it("clamps month-end anchors", () => {
    expect(nthOccurrence({ frequency: "monthly", interval: 1, anchorDate: "2026-01-31", endDate: null }, 1)).toBe("2026-02-28");
    expect(nthOccurrence({ frequency: "monthly", interval: 1, anchorDate: "2026-01-31", endDate: null }, 2)).toBe("2026-03-31");
  });

  it("respects end dates and intervals", () => {
    const rule = { frequency: "weekly" as const, interval: 2, anchorDate: "2026-03-02", endDate: "2026-03-31" };
    expect(occurrencesBetween(rule, "2026-03-01", "2026-04-30")).toEqual(["2026-03-02", "2026-03-16", "2026-03-30"]);
    expect(nextOccurrenceOnOrAfter(rule, "2026-04-01")).toBeNull();
  });
});

describe("cash-flow projection", () => {
  it("carries balances month to month and honours nextDueOn", () => {
    const projection = projectCashFlow({ startingCents: 100_000, from: "2026-03-15", months: 3, rules: [salary, rent] });
    expect(projection.months.map((month) => month.month)).toEqual(["2026-03", "2026-04", "2026-05"]);
    const march = projection.months[0]!;
    expect(march.items.map((item) => item.name)).toEqual(["Salary"]);
    expect(march.closingCents).toBe(350_000);
    const april = projection.months[1]!;
    expect(april.openingCents).toBe(350_000);
    expect(april.incomeCents).toBe(250_000);
    expect(april.expenseCents).toBe(95_000);
    expect(april.closingCents).toBe(505_000);
  });

  it("adds average discretionary spending to every month", () => {
    const projection = projectCashFlow({ startingCents: 0, from: "2026-03-01", months: 2, rules: [], averageDiscretionaryExpenseCents: 40_000 });
    expect(projection.months[1]!.closingCents).toBe(-80_000);
  });

  it("only counts the rest of the current month when starting mid-month", () => {
    const projection = projectCashFlow({ startingCents: 0, from: "2026-04-21", months: 2, rules: [], averageDiscretionaryExpenseCents: 30_000 });
    expect(projection.months[0]!.expenseCents).toBe(10_000);
    expect(projection.months[1]!.expenseCents).toBe(30_000);
  });
});

describe("recurrence edge cases", () => {
  it("keeps yearly anchors on the 29th of February in range", () => {
    const rule = { frequency: "yearly" as const, interval: 1, anchorDate: "2028-02-29", endDate: null };
    expect(nthOccurrence(rule, 1)).toBe("2029-02-28");
    expect(nthOccurrence(rule, 4)).toBe("2032-02-29");
  });

  it("finds the next occurrence on or after a date", () => {
    const rule = { frequency: "monthly" as const, interval: 2, anchorDate: "2026-01-15", endDate: null };
    expect(nextOccurrenceOnOrAfter(rule, "2026-01-16")).toBe("2026-03-15");
    expect(nextOccurrenceOnOrAfter(rule, "2026-03-15")).toBe("2026-03-15");
  });
});
