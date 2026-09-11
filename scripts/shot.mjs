import { chromium } from "@playwright/test";

const BASE = "http://localhost:4173/verbands-ceo-workshop/#";
const shots = [
  ["s/00.01", "cover"],
  ["s/02.05", "exercise"],
  ["s/03.04", "wirksamkeit"],
  ["protokoll", "protokoll"],
];

// Pass the client-side login gate (see src/components/LoginGate.tsx).
const AUTH_HASH = "df617b21b8aee6210556bc3949b2d7c6bff8a9d53445323eb8652b70cd13cc36";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript((hash) => localStorage.setItem("verbands-ceo.auth.v1", hash), AUTH_HASH);
for (const [route, name] of shots) {
  await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `scripts/_shot-${name}.png` });
  console.log("shot", name);
}
await browser.close();
