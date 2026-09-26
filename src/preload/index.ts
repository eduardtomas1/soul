import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNEL_NAMES, IPC_EVENT_NAMES } from "@shared/ipc-names";

const channels = new Set<string>(IPC_CHANNEL_NAMES);
const events = new Set<string>(IPC_EVENT_NAMES);

const api = {
  invoke(channel: string, payload: unknown): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
    if (!channels.has(channel)) return Promise.resolve({ ok: false, error: `Unknown channel ${channel}.` });
    return ipcRenderer.invoke(channel, payload) as Promise<{ ok: true; value: unknown } | { ok: false; error: string }>;
  },
  on(event: string, listener: (payload: unknown) => void): () => void {
    if (!events.has(event)) return () => undefined;
    const wrapped = (_event: unknown, payload: unknown) => listener(payload);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.removeListener(event, wrapped);
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld("soul", api);

export type SoulBridge = typeof api;
