import { describe, expect, it } from "vitest";
import { computeStreaks } from "../src/shared/streaks";
import { EVERY_DAY_MASK, weekdaysToMask } from "../src/shared/dates";

function counts(entries: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(entries));
}

describe("daily streaks", () => {
  it("counts consecutive scheduled days and keeps today open", () => {
    const result = computeStreaks({
      cadence: "daily",
      weekdayMask: EVERY_DAY_MASK,
      targetCount: 1,
      counts: counts({ "2026-03-01": 1, "2026-03-02": 1, "2026-03-03": 1 }),
      createdOn: "2026-03-01",
      today: "2026-03-04",
    });
    expect(result.current).toBe(3);
    expect(result.best).toBe(3);
    expect(result.totalCompleted).toBe(3);
  });

  it("skips unscheduled weekdays without breaking the run", () => {
    const weekdaysOnly = weekdaysToMask([0, 1, 2, 3, 4]);
    const result = computeStreaks({
      cadence: "daily",
      weekdayMask: weekdaysOnly,
      targetCount: 1,
      counts: counts({ "2026-03-05": 1, "2026-03-06": 1, "2026-03-09": 1 }),
      createdOn: "2026-03-05",
      today: "2026-03-09",
    });
    expect(result.current).toBe(3);
  });

  it("resets after a missed day but remembers the best run", () => {
    const result = computeStreaks({
      cadence: "daily",
      weekdayMask: EVERY_DAY_MASK,
      targetCount: 2,
      counts: counts({ "2026-03-01": 2, "2026-03-02": 2, "2026-03-03": 1, "2026-03-04": 2 }),
      createdOn: "2026-03-01",
      today: "2026-03-04",
    });
    expect(result.best).toBe(2);
    expect(result.current).toBe(1);
  });
});

describe("weekly streaks", () => {
  it("sums the week starting on Monday", () => {
    const result = computeStreaks({
      cadence: "weekly",
      weekdayMask: EVERY_DAY_MASK,
      targetCount: 3,
      counts: counts({ "2026-03-02": 1, "2026-03-04": 1, "2026-03-07": 1, "2026-03-09": 2 }),
      createdOn: "2026-03-02",
      today: "2026-03-10",
    });
    expect(result.current).toBe(1);
    expect(result.best).toBe(1);
  });
});
