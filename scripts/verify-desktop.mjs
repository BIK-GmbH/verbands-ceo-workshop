import { chromium } from "@playwright/test";
const URL = process.env.URL ?? "http://localhost:5174";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "de-DE",
});
const page = await ctx.newPage();
await page.goto(`${URL}#/s/00.01`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.getElementById("splash"), { timeout: 3000 }).catch(() => {});
await page.waitForTimeout(200);

await page.screenshot({ path: "/tmp/desktop-footer.png", fullPage: false });

// Open palette
await page.keyboard.press("Meta+K");
await page.waitForTimeout(180);
await page.screenshot({ path: "/tmp/desktop-palette.png", fullPage: false });

await browser.close();
console.log("Screenshots: /tmp/desktop-footer.png + /tmp/desktop-palette.png");
