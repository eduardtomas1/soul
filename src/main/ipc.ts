import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { z } from "zod";
import {
  ipcChannels,
  IPC_CHANNEL_NAMES,
  type DataScope,
  type IpcChannel,
  type IpcEvent,
  type IpcInput,
  type IpcOutput,
} from "@shared/ipc";

export type Handler<C extends IpcChannel> = (input: z.output<(typeof ipcChannels)[C]["input"]>) => IpcOutput<C> | Promise<IpcOutput<C>>;

export interface IpcRouter {
  readonly handle: <C extends IpcChannel>(channel: C, handler: Handler<C>, changes?: DataScope) => void;
  readonly emit: (event: IpcEvent, payload: unknown) => void;
  readonly changed: (scope: DataScope) => void;
  readonly assertComplete: () => void;
  readonly attach: (window: BrowserWindow) => void;
  readonly onChanged: (listener: (scope: DataScope) => void) => void;
}

export class IpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IpcError";
  }
}

export function createIpcRouter(): IpcRouter {
  const registered = new Set<IpcChannel>();
  const windows = new Set<BrowserWindow>();
  const changeListeners = new Set<(scope: DataScope) => void>();

  function emit(event: IpcEvent, payload: unknown): void {
    for (const window of windows) {
      if (!window.isDestroyed()) window.webContents.send(event, payload);
    }
  }

  function changed(scope: DataScope): void {
    emit("data.changed", { scope });
    for (const listener of changeListeners) listener(scope);
  }

  return {
    handle(channel, handler, changes) {
      const schema = ipcChannels[channel].input;
      registered.add(channel);
      ipcMain.handle(channel, async (_event: IpcMainInvokeEvent, raw: unknown) => {
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          return { ok: false, error: `Invalid request for ${channel}.` };
        }
        try {
          const result = await handler(parsed.data as z.output<(typeof ipcChannels)[typeof channel]["input"]>);
          if (changes) changed(changes);
          return { ok: true, value: result ?? null };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Something went wrong.";
          return { ok: false, error: message };
        }
      });
    },
    emit,
    changed,
    onChanged(listener) {
      changeListeners.add(listener);
    },
    assertComplete() {
      const missing = IPC_CHANNEL_NAMES.filter((name) => !registered.has(name));
      if (missing.length > 0) throw new Error(`IPC handlers missing: ${missing.join(", ")}`);
    },
    attach(window) {
      windows.add(window);
      window.on("closed", () => windows.delete(window));
    },
  };
}

export type { IpcInput };
