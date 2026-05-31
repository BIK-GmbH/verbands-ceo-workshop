import { chromium } from "@playwright/test";
const URL = process.env.URL ?? "http://localhost:5174";

const browser = await chromium.launch();

// Mobile shot
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true, isMobile: true, locale: "de-DE",
  });
  const page = await ctx.newPage();
  // Throttle so splash stays visible long enough to capture
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 100,
    downloadThroughput: 200_000, uploadThroughput: 200_000,
  });
  const navP = page.goto(`${URL}#/s/00.01`);
  await page.waitForSelector("#splash", { state: "attached", timeout: 5000 });
  await page.waitForTimeout(180);
  await page.screenshot({ path: "/tmp/splash-mobile.png", fullPage: false });
  await navP;
  await ctx.close();
}

// Desktop shot
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: "de-DE",
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 100,
    downloadThroughput: 300_000, uploadThroughput: 300_000,
  });
  const navP = page.goto(`${URL}#/s/00.01`);
  await page.waitForSelector("#splash", { state: "attached", timeout: 5000 });
  await page.waitForTimeout(180);
  await page.screenshot({ path: "/tmp/splash-desktop.png", fullPage: false });
  await navP;
  await ctx.close();
}

await browser.close();
console.log("Screenshots: /tmp/splash-mobile.png + /tmp/splash-desktop.png");
