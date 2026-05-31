import { test, expect } from "@playwright/test";

test.describe("Presentation mode", () => {
  test("entering from header switches to /p/:slideId", async ({ page }) => {
    await page.goto("/#/s/01.02");
    await page.getByTestId("enter-presentation").click();
    await expect(page).toHaveURL(/#\/p\/01\.02/);
    await expect(page.locator("[data-presentation]")).toBeVisible();
    // Sidebar must be gone
    await expect(page.locator("[data-workshop-sidebar]")).toHaveCount(0);
  });

  test("ArrowRight navigates between presentation slides", async ({ page }) => {
    await page.goto("/#/p/00.01");
    await page.locator("body").click();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/p\/00\.02/);
  });

  test("Esc exits to docs view of same slide", async ({ page }) => {
    await page.goto("/#/p/03.04");
    await page.locator("body").click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/#\/s\/03\.04/);
    await expect(page.locator("[data-workshop-sidebar]")).toBeVisible();
  });

  test("N toggles speaker notes overlay", async ({ page }) => {
    await page.goto("/#/p/00.01");
    await page.locator("body").click();
    // Speaker notes hidden initially
    await expect(page.locator("[data-speaker-notes]")).toBeHidden();
    await page.keyboard.press("n");
    await expect(page.locator("[data-speaker-notes]")).toBeVisible();
    await page.keyboard.press("n");
    await expect(page.locator("[data-speaker-notes]")).toBeHidden();
  });

  test("slide content renders inside the 16:9 box", async ({ page }) => {
    await page.goto("/#/p/00.01");
    const slide = page.locator(".presentation-slide");
    await expect(slide).toBeVisible();
    await expect(slide).toContainText("Claude Code Workshop");
  });

  test("counter shows position", async ({ page }) => {
    await page.goto("/#/p/00.01");
    // counter looks like "1 / 53"
    await expect(page.locator("[data-presentation]")).toContainText(/\d+\s*\/\s*\d+/);
  });
});
