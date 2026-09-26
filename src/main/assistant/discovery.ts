import { execFile } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import type { ProviderId, ProviderStatus } from "@shared/contracts/assistant";
import { commandFor } from "./command";

const PROVIDER_NAMES: Record<ProviderId, string> = { claude: "Claude Code", codex: "Codex" };
const DETECTION_TIMEOUT_MS = 4_000;

function extraDirectories(): string[] {
  const home = homedir();
  const directories = [
    join(home, ".local", "bin"),
    join(home, ".npm-global", "bin"),
    join(home, ".claude", "local"),
    join(home, ".codex", "bin"),
    join(home, "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
  ];
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    const localAppData = process.env.LOCALAPPDATA;
    if (appData) directories.push(join(appData, "npm"));
    if (localAppData) directories.push(join(localAppData, "Programs", "claude"), join(localAppData, "Programs", "codex"));
  }
  return directories;
}

function candidateNames(name: string): string[] {
  if (process.platform !== "win32") return [name];
  return [`${name}.exe`, `${name}.cmd`, `${name}.bat`, name];
}

export function findExecutable(name: string): string | null {
  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter((entry) => entry.length > 0);
  for (const directory of [...pathEntries, ...extraDirectories()]) {
    for (const candidate of candidateNames(name)) {
      const full = join(directory, candidate);
      try {
        accessSync(full, constants.X_OK);
        return full;
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function runVersion(executable: string): Promise<string | null> {
  return new Promise((resolve) => {
    const invocation = commandFor(executable, ["--version"]);
    execFile(invocation.command, [...invocation.args], { timeout: DETECTION_TIMEOUT_MS, windowsHide: true, maxBuffer: 64 * 1024, windowsVerbatimArguments: invocation.windowsVerbatimArguments }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      const match = /(\d+\.\d+\.\d+[\w.-]*)/u.exec(stdout);
      resolve(match?.[1] ?? stdout.trim().slice(0, 40) ?? null);
    });
  });
}

export async function detectProvider(id: ProviderId): Promise<ProviderStatus> {
  const executable = findExecutable(id);
  if (!executable) {
    return { id, name: PROVIDER_NAMES[id], installed: false, version: null, executable: null, detail: `Install the ${PROVIDER_NAMES[id]} CLI and sign in to use it here.` };
  }
  const version = await runVersion(executable);
  if (version === null) {
    return { id, name: PROVIDER_NAMES[id], installed: false, version: null, executable, detail: `${PROVIDER_NAMES[id]} was found but did not respond.` };
  }
  return { id, name: PROVIDER_NAMES[id], installed: true, version, executable, detail: null };
}

export async function detectProviders(): Promise<ProviderStatus[]> {
  return Promise.all((["claude", "codex"] as const).map(detectProvider));
}
