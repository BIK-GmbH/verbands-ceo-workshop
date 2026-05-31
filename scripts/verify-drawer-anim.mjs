import { chromium } from "@playwright/test";

const URL = process.env.URL ?? "http://localhost:5174";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true, isMobile: true, locale: "de-DE",
});
const page = await ctx.newPage();
await page.goto(`${URL}#/s/00.01`, { waitUntil: "networkidle" });

// Open drawer, snapshot mid-animation
await page.getByTestId("mobile-sidebar-toggle").click();
await page.waitForTimeout(120);   // mid-slide-in (~50% of 240ms)
await page.screenshot({ path: "/tmp/drawer-opening.png", fullPage: false });
await page.waitForTimeout(200);   // settled
await page.screenshot({ path: "/tmp/drawer-open.png", fullPage: false });

// Trigger close, mid-animation snapshot
await page.getByTestId("sidebar-backdrop").click({ position: { x: 350, y: 400 } });
await page.waitForTimeout(100);
await page.screenshot({ path: "/tmp/drawer-closing.png", fullPage: false });

// Accordion: open module 3 (was closed) and snapshot mid-expand
await page.getByTestId("mobile-sidebar-toggle").click();
await page.waitForTimeout(280);
const drawer = page.locator("[data-workshop-sidebar-mobile]");
await drawer.getByTestId("module-toggle-3").click();
await page.waitForTimeout(110);
await page.screenshot({ path: "/tmp/accordion-opening.png", fullPage: false });
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/accordion-open.png", fullPage: false });

await browser.close();
console.log("Screenshots: /tmp/drawer-*.png + /tmp/accordion-*.png");
