import path from "node:path";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { test, expect, SLIDE_COUNT } from "./fixtures";

test.describe("Print + PDF export", () => {
  test("print view renders exactly the slides the manifest declares", async ({ page }) => {
    await page.goto("/#/print");
    const slides = page.locator(".slide-page");
    await expect(slides.first()).toBeVisible();
    // Exact count, not a lower bound: a slide silently dropping out of the print
    // view is precisely the failure this test exists to catch.
    await expect(slides).toHaveCount(SLIDE_COUNT);
  });

  test("print view hides the workshop chrome", async ({ page }) => {
    await page.goto("/#/print");
    await expect(page.locator("[data-workshop-header]")).toHaveCount(0);
    await expect(page.locator("[data-workshop-sidebar]")).toHaveCount(0);
    await expect(page.locator("[data-workshop-footer]")).toHaveCount(0);
  });

  test("page.pdf() produces a non-trivial PDF", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const outDir = path.resolve("test-results/pdf");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `e2e-${testInfo.workerIndex}.pdf`);

    await page.goto("/#/print");
    await page.locator(".slide-page").first().waitFor();

    await page.pdf({
      path: out,
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });

    // A PDF of the whole deck is far bigger than this; the bound only catches an
    // export that produced a blank or near-empty document.
    expect(statSync(out).size).toBeGreaterThan(50_000);
  });
});
