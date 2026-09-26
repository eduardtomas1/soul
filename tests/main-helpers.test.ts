import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { commandFor } from "../src/main/assistant/command";
import { createFileGrants } from "../src/main/file-grants";
import { isRendererUrl } from "../src/main/navigation";
import { modelNameSchema } from "../src/shared/contracts/settings";

describe("model names", () => {
  it("accepts provider model names and nothing that could become a flag or a command", () => {
    for (const name of ["", "opus", "sonnet[1m]", "claude-sonnet-4-5-20250929[1m]", "gpt-5.5", "openai/gpt-5@x:y"]) {
      expect(modelNameSchema.safeParse(name).success).toBe(true);
    }
    for (const name of ["--dangerously-bypass-approvals-and-sandbox", "-m", "bad model", "a&b", "x|y", "\"q\"", "[1m]"]) {
      expect(modelNameSchema.safeParse(name).success).toBe(false);
    }
  });
});

describe("provider commands", () => {
  it("runs executables directly", () => {
    expect(commandFor("/usr/local/bin/codex", ["exec", "-"])).toEqual({ command: "/usr/local/bin/codex", args: ["exec", "-"], windowsVerbatimArguments: false });
  });

  it("quotes batch files and their arguments for cmd", () => {
    const invocation = commandFor("C:\\Program Files\\nodejs\\codex.cmd", ["exec", "--model", "gpt-5.5", "a b"], "cmd.exe");
    expect(invocation.command).toBe("cmd.exe");
    expect(invocation.args).toEqual(["/d", "/s", "/c", "\"\"C:\\Program Files\\nodejs\\codex.cmd\" exec --model gpt-5.5 \"a b\"\""]);
    expect(invocation.windowsVerbatimArguments).toBe(true);
  });

  it("refuses arguments cmd would reinterpret", () => {
    for (const unsafe of ["a&b", "50%", "x|y", "\"quoted\"", "<in"]) {
      expect(() => commandFor("C:\\tools\\codex.cmd", [unsafe], "cmd.exe")).toThrow(/Unsupported character/u);
    }
  });

  it.runIf(process.platform === "win32")("launches a batch file that lives in a folder with spaces", () => {
    const directory = mkdtempSync(join(tmpdir(), "soul spaces "));
    try {
      const script = join(directory, "fake codex.cmd");
      writeFileSync(script, "@echo off\r\necho first=%~1 second=%~2 count=%3\r\n");
      const invocation = commandFor(script, ["exec", "two words", "--flag"]);
      const result = spawnSync(invocation.command, [...invocation.args], { windowsVerbatimArguments: invocation.windowsVerbatimArguments, encoding: "utf8" });
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe("first=exec second=two words count=--flag");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("renderer navigation", () => {
  const packaged = "file:///C:/Program%20Files/Soul/resources/app.asar/out/renderer/index.html";

  it("allows only the app's own page", () => {
    expect(isRendererUrl(packaged, packaged, false)).toBe(true);
    expect(isRendererUrl(`${packaged}#today`, packaged, false)).toBe(true);
    expect(isRendererUrl("file:///C:/Users/me/Downloads/page.html", packaged, false)).toBe(false);
    expect(isRendererUrl("http://localhost:5173/", packaged, false)).toBe(false);
    expect(isRendererUrl("https://example.com/", packaged, false)).toBe(false);
    expect(isRendererUrl("not a url", packaged, false)).toBe(false);
  });

  it("allows the dev server origin while developing", () => {
    expect(isRendererUrl("http://localhost:5173/src/main.tsx", "http://localhost:5173/", true)).toBe(true);
    expect(isRendererUrl("http://localhost:3000/", "http://localhost:5173/", true)).toBe(false);
  });
});

describe("file grants", () => {
  it("only lets the renderer use files the person picked", () => {
    const files = createFileGrants();
    const picked = join(tmpdir(), "statement.csv");
    expect(() => files.require(picked)).toThrow(/Choose the file again/u);
    expect(files.grant(picked)).toBe(picked);
    expect(files.require(join(tmpdir(), ".", "statement.csv"))).toBe(join(tmpdir(), ".", "statement.csv"));
    expect(() => files.require(join(tmpdir(), "other.csv"))).toThrow();
    expect(files.require(`${tmpdir()}${sep}folder${sep}..${sep}statement.csv`)).toBe(picked);
  });
});
