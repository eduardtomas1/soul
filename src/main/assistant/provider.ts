export interface ProviderRunOptions {
  readonly executable: string;
  readonly cwd: string;
  readonly env: Record<string, string>;
  readonly prompt: string;
  readonly model: string | null;
  readonly sessionId: string | null;
  readonly onDelta: (text: string) => void;
  readonly onActivity: (label: string) => void;
  readonly onSession: (sessionId: string) => void;
}

export interface ProviderRun {
  readonly finished: Promise<string>;
  readonly cancel: () => void;
}

export function providerEnvironment(appVersion: string): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (/^(?:ELECTRON_|SOUL_|VITE_)/u.test(key)) continue;
    environment[key] = value;
  }
  environment.CLAUDE_AGENT_SDK_CLIENT_APP = `soul/${appVersion}`;
  return environment;
}
