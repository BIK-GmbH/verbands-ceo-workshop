import { chromium } from "@playwright/test";

const BASE = "http://localhost:4173/verbands-ceo-workshop/#";
const shots = [
  ["s/00.01", "cover"],
  ["s/02.05", "exercise"],
  ["s/03.04", "wirksamkeit"],
  ["protokoll", "protokoll"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
for (const [route, name] of shots) {
  await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `scripts/_shot-${name}.png` });
  console.log("shot", name);
}
await browser.close();
