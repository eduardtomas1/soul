import { afterEach, describe, expect, it } from "vitest";
import { localDateOf, localTimestamp } from "../src/shared/dates";

const zone = process.env.TZ;

afterEach(() => {
  process.env.TZ = zone;
});

describe("local time", () => {
  it("keeps a reminder at its wall-clock time on daylight-saving days", () => {
    process.env.TZ = "Europe/Madrid";
    for (const day of ["2026-03-29", "2026-10-25", "2026-06-01"]) {
      const at = new Date(localTimestamp(day, "08:00"));
      expect([at.getHours(), at.getMinutes()]).toEqual([8, 0]);
    }
  });

  it("reads timestamps as local calendar days", () => {
    process.env.TZ = "Europe/Madrid";
    expect(localDateOf("2026-03-01T23:30:00.000Z")).toBe("2026-03-02");
    expect(localDateOf("2026-07-01T21:30:00.000Z")).toBe("2026-07-01");
  });
});
