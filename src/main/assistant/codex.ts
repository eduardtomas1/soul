import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { commandFor } from "./command";
import type { ProviderRun, ProviderRunOptions } from "./provider";

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

interface CodexEvent {
  type?: string;
  item?: { type?: string; text?: string; command?: string };
  error?: { message?: string } | string;
  message?: string;
}

export function runCodex(options: ProviderRunOptions): ProviderRun {
  let child: ChildProcessWithoutNullStreams | null = null;
  let cancelled = false;

  const finished = new Promise<string>((resolve, reject) => {
    const args = ["exec", "--json", "--skip-git-repo-check", "--sandbox", "read-only", "--color", "never"];
    if (options.model) args.push(`--model=${options.model}`);
    args.push("-");
    const invocation = commandFor(options.executable, args);
    child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      stdio: "pipe",
    });

    let buffer = "";
    let received = 0;
    let finalText = "";
    let failure: string | null = null;
    const stderrTail: string[] = [];

    function handleLine(line: string): void {
      if (line.trim().length === 0) return;
      let event: CodexEvent;
      try {
        event = JSON.parse(line) as CodexEvent;
      } catch {
        return;
      }
      if (event.type === "item.completed" && event.item?.type === "agent_message" && typeof event.item.text === "string") {
        finalText = event.item.text;
        options.onDelta(event.item.text);
      } else if (event.type === "item.started" && event.item?.type === "reasoning") {
        options.onActivity("Thinking");
      } else if (event.type === "item.started" && event.item?.type === "command_execution") {
        options.onActivity("Running a command");
      } else if (event.type === "turn.failed" || event.type === "error") {
        const message = typeof event.error === "string" ? event.error : event.error?.message ?? event.message;
        failure = message ?? "Codex reported an error.";
      }
    }

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      received += chunk.length;
      if (received > MAX_OUTPUT_BYTES) {
        failure = "Codex produced too much output.";
        child?.kill();
        return;
      }
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        handleLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderrTail.push(chunk);
      if (stderrTail.length > 40) stderrTail.shift();
    });
    child.on("error", (error) => reject(new Error(`Codex could not start: ${error.message}`)));
    child.on("close", (code) => {
      if (buffer.length > 0) handleLine(buffer);
      if (cancelled) {
        reject(new Error("cancelled"));
        return;
      }
      if (failure) {
        reject(new Error(failure));
        return;
      }
      if (code !== 0 && finalText.length === 0) {
        const detail = stderrTail.join("").trim().split("\n").slice(-3).join(" ").slice(0, 400);
        reject(new Error(detail.length > 0 ? detail : `Codex exited with code ${code ?? "unknown"}.`));
        return;
      }
      resolve(finalText);
    });
    child.stdin.end(options.prompt);
  });

  return {
    finished,
    cancel() {
      cancelled = true;
      child?.kill();
    },
  };
}
