import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: unknown, raw: unknown) => Promise<unknown>;
const handlers = new Map<string, Listener>();

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, listener: Listener) => {
      handlers.set(channel, listener);
    },
  },
}));

const { createIpcRouter } = await import("../src/main/ipc");

describe("ipc router", () => {
  beforeEach(() => handlers.clear());

  it("validates requests before a handler runs", async () => {
    const router = createIpcRouter();
    const handler = vi.fn(() => []);
    router.handle("routines.day", handler);
    await expect(handlers.get("routines.day")!(null, { date: "yesterday" })).resolves.toEqual({ ok: false, error: "Invalid request for routines.day." });
    expect(handler).not.toHaveBeenCalled();
    await expect(handlers.get("routines.day")!(null, { date: "2026-03-01" })).resolves.toEqual({ ok: true, value: [] });
  });

  it("reports handler errors and announces changes", async () => {
    const router = createIpcRouter();
    const changes: string[] = [];
    router.onChanged((scope) => changes.push(scope));
    router.handle("routines.delete", () => {
      throw new Error("Routine not found.");
    }, "routines");
    router.handle("routines.reorder", () => undefined, "routines");
    await expect(handlers.get("routines.delete")!(null, { id: "missing" })).resolves.toEqual({ ok: false, error: "Routine not found." });
    await expect(handlers.get("routines.reorder")!(null, { ids: [] })).resolves.toEqual({ ok: true, value: null });
    expect(changes).toEqual(["routines"]);
  });

  it("knows when a channel has no handler", () => {
    const router = createIpcRouter();
    expect(() => router.assertComplete()).toThrow(/IPC handlers missing/u);
  });
});
