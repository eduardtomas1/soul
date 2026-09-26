export interface ProcessCommand {
  readonly command: string;
  readonly args: readonly string[];
  readonly windowsVerbatimArguments: boolean;
}

const PLAIN_ARGUMENT = /^[\w.:/\\=@+,-]+$/u;

function quoteForCmd(argument: string): string {
  if (/["%!^&|<>\r\n]/u.test(argument)) throw new Error(`Unsupported character in command argument: ${argument}`);
  return PLAIN_ARGUMENT.test(argument) ? argument : `"${argument}"`;
}

export function isBatchFile(executable: string): boolean {
  return /\.(?:cmd|bat)$/iu.test(executable);
}

export function commandFor(executable: string, args: readonly string[], shell = process.env.ComSpec ?? "cmd.exe"): ProcessCommand {
  if (!isBatchFile(executable)) return { command: executable, args, windowsVerbatimArguments: false };
  const line = [`"${executable}"`, ...args.map(quoteForCmd)].join(" ");
  return { command: shell, args: ["/d", "/s", "/c", `"${line}"`], windowsVerbatimArguments: true };
}
