import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "resources", "icon.svg"), "utf8");
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(process.env.SOUL_CHROMIUM ? { executablePath: process.env.SOUL_CHROMIUM } : {}) });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
await page.locator("svg").screenshot({ path: join(root, "resources", "icon.png"), omitBackground: true });
await browser.close();
console.log("rendered resources/icon.png");
