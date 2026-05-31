import { chromium } from "@playwright/test";

const URL = "https://bik-gmbh.github.io/claude-code-workshop/";

const browser = await chromium.launch();
const page = await browser.newPage({ locale: "de-DE" });

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) =>
  errors.push(`requestfailed: ${r.url()} — ${r.failure()?.errorText}`),
);

await page.goto(URL, { waitUntil: "networkidle" });

// Cover slide check
const heading = await page.getByRole("heading", { level: 1 }).first().textContent();

// Sidebar nav to skill catalog
await page.locator('[data-testid="module-toggle-99"]').click();
await page.locator('[data-testid="slide-link-99.08"]').click();
await page.waitForURL(/99\.08/);
const catalogHeading = await page.getByRole("heading", { level: 1 }).first().textContent();

// Count skill cards
const cardCount = await page.locator("article").count();

await page.screenshot({ path: "/tmp/live-cover.png", fullPage: false });
await page.locator('[data-testid="slide-link-00.01"]').click();
await page.waitForURL(/00\.01/);
await page.screenshot({ path: "/tmp/live-cover-page.png", fullPage: false });

await browser.close();

console.log({
  url: URL,
  status: "OK",
  coverHeading: heading,
  catalogHeading,
  skillCardCount: cardCount,
  errors,
});
