import type { IpcChannel, IpcEvent, IpcInput, IpcOutput } from "@shared/ipc";

interface Bridge {
  invoke: (channel: string, payload: unknown) => Promise<{ ok: true; value: unknown } | { ok: false; error: string }>;
  on: (event: string, listener: (payload: unknown) => void) => () => void;
  platform: string;
}

declare global {
  interface Window {
    soul: Bridge;
  }
}

export class BridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BridgeError";
  }
}

export async function invoke<C extends IpcChannel>(channel: C, ...args: IpcInput<C> extends void ? [] : [IpcInput<C>]): Promise<IpcOutput<C>> {
  const result = await window.soul.invoke(channel, args[0] ?? undefined);
  if (!result.ok) throw new BridgeError(result.error);
  return result.value as IpcOutput<C>;
}

export function subscribe<T = unknown>(event: IpcEvent, listener: (payload: T) => void): () => void {
  return window.soul.on(event, (payload) => listener(payload as T));
}

export const platform = typeof window !== "undefined" && window.soul ? window.soul.platform : "linux";
