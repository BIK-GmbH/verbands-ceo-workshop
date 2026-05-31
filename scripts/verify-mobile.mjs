import { chromium } from "@playwright/test";

const URL = process.env.URL ?? "http://localhost:5174";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  locale: "de-DE",
});
const page = await ctx.newPage();

await page.goto(`${URL}#/s/00.01`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !document.getElementById("splash"), { timeout: 3000 }).catch(() => {});
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/mobile-1-cover.png", fullPage: false });

// Open mobile sidebar
await page.getByTestId("mobile-sidebar-toggle").click();
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/mobile-2-drawer.png", fullPage: false });

// Close + go to skill catalog (99.08) via direct navigation
await page.getByTestId("sidebar-backdrop").click({ position: { x: 350, y: 400 } });
await page.goto(`${URL}#/s/99.08`, { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/mobile-3-skills.png", fullPage: false });

// Presentation mode
await page.goto(`${URL}#/p/00.02`, { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/mobile-4-present.png", fullPage: false });

// Presentation w/ notes
await page.locator("body").click();
await page.keyboard.press("n");
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/mobile-5-present-notes.png", fullPage: false });

await browser.close();
console.log("Screenshots: /tmp/mobile-*.png");
