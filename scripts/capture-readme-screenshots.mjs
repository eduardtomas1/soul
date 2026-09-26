import { _electron as electron } from "@playwright/test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedDemoData } from "./demo-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(root, "docs", "screenshots");
const captureRoot = mkdtempSync(join(tmpdir(), "soul-readme-"));
const dataDirectory = join(captureRoot, "data");
const profileDirectory = join(captureRoot, "profile");
const fakeBinDirectory = join(captureRoot, "bin");
mkdirSync(dataDirectory, { recursive: true });
mkdirSync(profileDirectory, { recursive: true });
mkdirSync(fakeBinDirectory, { recursive: true });
mkdirSync(outputDirectory, { recursive: true });

const FAKE_VERSIONS = { claude: "2.1.0 (Claude Code)", codex: "codex-cli 0.58.0" };
for (const [name, version] of Object.entries(FAKE_VERSIONS)) {
  if (process.platform === "win32") {
    writeFileSync(join(fakeBinDirectory, `${name}.cmd`), `@echo off\r\nif not "%~1"=="--version" exit /b 1\r\necho ${version}\r\n`);
  } else {
    const path = join(fakeBinDirectory, name);
    writeFileSync(path, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "${version}"; exit 0; fi\nexit 1\n`);
    chmodSync(path, 0o755);
  }
}

const WIDTH = 1400;
const HEIGHT = 880;

const app = await electron.launch({
  args: [root, "--no-sandbox", "--disable-gpu", `--user-data-dir=${profileDirectory}`],
  env: {
    ...process.env,
    SOUL_DATA_DIR: dataDirectory,
    PATH: `${fakeBinDirectory}${delimiter}${process.env.PATH ?? ""}`,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
    TZ: process.env.TZ ?? "Europe/Madrid",
  },
});

const page = await app.firstWindow();
await app.evaluate(({ BrowserWindow }, size) => {
  const window = BrowserWindow.getAllWindows()[0];
  window?.setContentSize(size.width, size.height);
  window?.center();
}, { width: WIDTH, height: HEIGHT });
await page.waitForLoadState("domcontentloaded");
await page.waitForSelector("aside");

async function call(channel, payload) {
  const result = await page.evaluate(([channelName, input]) => window.soul.invoke(channelName, input), [channel, payload]);
  if (!result.ok) throw new Error(`${channel}: ${result.error}`);
  return result.value;
}

async function capture(name, { theme } = {}) {
  if (theme) await call("settings.update", { theme });
  await page.waitForTimeout(650);
  await page.screenshot({ path: join(outputDirectory, `${name}.png`), animations: "disabled" });
  console.log(`captured ${name}`);
}

async function go(view, tab, focusId) {
  await page.evaluate(([nextView, nextTab, nextFocus]) => {
    window.dispatchEvent(new CustomEvent("soul:navigate", { detail: { view: nextView, tab: nextTab, focusId: nextFocus } }));
  }, [view, tab ?? null, focusId ?? null]);
  await page.waitForTimeout(400);
}

try {
  await seedDemoData(call, { dataDirectory });
  await call("settings.update", { reduceMotion: "always" });
  await page.reload();
  await page.waitForSelector("aside");
  await page.waitForTimeout(800);

  await capture("soul-today", { theme: "light" });
  await capture("soul-today-dark", { theme: "dark" });
  await capture("soul-today-natural", { theme: "natural" });
  await call("settings.update", { theme: "light" });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+L" : "Control+L");
  await page.getByPlaceholder("Coffee, groceries, taxi…").fill("Coffee");
  await capture("soul-log");
  await page.keyboard.press("Escape");
  await go("journal");
  await capture("soul-journal");
  await go("measures");
  await capture("soul-measures");
  await go("routines");
  await capture("soul-routines");
  await go("habits");
  await capture("soul-habits");
  await go("habits", "medals");
  await capture("soul-medals");
  await go("finances", "overview");
  await capture("soul-money");
  await go("finances", "transactions");
  await capture("soul-transactions");
  await go("finances", "goals");
  await capture("soul-goals");
  await go("assistant");
  await page.getByText("Where does the money go on weekends?").first().click();
  await capture("soul-assistant");
  await go("settings", "backup");
  await capture("soul-backup");
} finally {
  await app.close();
  rmSync(captureRoot, { recursive: true, force: true });
}
