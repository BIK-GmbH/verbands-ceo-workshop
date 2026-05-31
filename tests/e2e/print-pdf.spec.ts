import { test, expect } from "@playwright/test";
import path from "node:path";
import { existsSync, mkdirSync, statSync } from "node:fs";

test.describe("Print + PDF export", () => {
  test("/print renders all slides linearly", async ({ page }) => {
    await page.goto("/#/print");
    await page.waitForSelector(".slide-page");
    const slides = page.locator(".slide-page");
    const count = await slides.count();
    expect(count).toBeGreaterThanOrEqual(40);
    // First slide should contain the cover heading
    await expect(slides.first()).toContainText("Claude Code Workshop");
  });

  test("/print hides workshop chrome", async ({ page }) => {
    await page.goto("/#/print");
    await expect(page.locator("[data-workshop-header]")).toHaveCount(0);
    await expect(page.locator("[data-workshop-sidebar]")).toHaveCount(0);
    await expect(page.locator("[data-workshop-footer]")).toHaveCount(0);
  });

  test("page.pdf() produces a valid PDF", async ({ page }, testInfo) => {
    const outDir = path.resolve("test-results/pdf");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `e2e-${testInfo.workerIndex}.pdf`);

    await page.goto("/#/print", { waitUntil: "networkidle" });
    await page.waitForSelector(".slide-page");

    if (!page.context().browser()?.browserType().name().includes("chromium")) {
      test.skip(true, "page.pdf() is Chromium-only");
    }

    await page.pdf({
      path: out,
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });

    const stat = statSync(out);
    // PDF must be at least ~50 KB to confirm it has actual content
    expect(stat.size).toBeGreaterThan(50_000);
  });
});
