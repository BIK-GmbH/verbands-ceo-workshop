import { test, expect } from "@playwright/test";

test.describe("Phase 1 smoke", () => {
  test("app renders header, sidebar, footer and first slide", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/#\/s\/00\.01$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Claude Code Workshop");
    await expect(page.locator("[data-workshop-header]")).toBeVisible();
    await expect(page.locator("[data-workshop-sidebar]")).toBeVisible();
    await expect(page.locator("[data-workshop-footer]")).toBeVisible();
  });

  test("ArrowRight navigates to next slide", async ({ page }) => {
    await page.goto("/#/s/00.01");
    await page.locator("[data-workshop-content]").waitFor();
    // Focus body so the keymap definitely receives the keystroke.
    await page.locator("body").click();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/s\/00\.02$/, { timeout: 5_000 });
  });

  test("ArrowLeft navigates back", async ({ page }) => {
    await page.goto("/#/s/00.02");
    await page.locator("body").click();
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/#\/s\/00\.01$/);
  });

  test("Sidebar click navigates", async ({ page }) => {
    await page.goto("/#/s/00.01");
    await page.getByTestId("module-toggle-1").click();
    await page.getByTestId("slide-link-01.03").click();
    await expect(page).toHaveURL(/#\/s\/01\.03$/);
  });

  test("Theme toggle switches data-theme", async ({ page }) => {
    await page.goto("/#/s/00.01");
    const html = page.locator("html");
    const before = await html.getAttribute("data-theme");
    await page.getByTestId("theme-toggle").click();
    const after = await html.getAttribute("data-theme");
    expect(after).not.toBe(before);
  });

  test("Lang toggle changes language", async ({ page }) => {
    await page.goto("/#/s/00.01");
    await page.getByTestId("lang-en").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("Motion toggle cycles auto → on → off → auto", async ({ page }) => {
    await page.goto("/#/s/00.01");
    const html = page.locator("html");
    const btn = page.getByTestId("motion-toggle");
    // initial: auto
    await expect(btn).toHaveAttribute("data-motion-mode", "auto");
    await btn.click();
    await expect(btn).toHaveAttribute("data-motion-mode", "on");
    await expect(html).toHaveAttribute("data-motion", "on");
    await btn.click();
    await expect(btn).toHaveAttribute("data-motion-mode", "off");
    await expect(html).toHaveAttribute("data-motion", "off");
    await btn.click();
    await expect(btn).toHaveAttribute("data-motion-mode", "auto");
  });

  test("Progress bar reflects current slide position", async ({ page }) => {
    await page.goto("/#/s/00.01");
    const bar = page.locator("[data-progress-bar] > div");
    await expect(bar).toBeVisible();
    const w1 = await bar.getAttribute("style");
    expect(w1).toMatch(/width:\s*[\d.]+%/);
    // Jump to last slide via direct route
    await page.goto("/#/s/99.08");
    await page.waitForURL(/99\.08/);
    await expect(bar).toHaveAttribute("style", /width:\s*100%/);
  });

  test("Scroll memory restores position on slide back-and-forth", async ({ page }) => {
    await page.goto("/#/s/99.08"); // long Top Skills catalog slide
    const main = page.locator("[data-workshop-content]");
    await main.evaluate((el) => { (el as HTMLElement).scrollTop = 600; });
    await page.waitForTimeout(150); // let RAF save with margin
    // Navigate back via keyboard
    await page.locator("body").click();
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/#\/s\/99\.07/);
    // Forward again — restore ≈ 600 (the actually meaningful assertion)
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/s\/99\.08/);
    await page.waitForTimeout(150);
    const restored = await main.evaluate((el) => (el as HTMLElement).scrollTop);
    expect(restored).toBeGreaterThan(400);
  });

  test("Cmd+K opens command palette", async ({ page }) => {
    await page.goto("/#/s/00.01");
    await page.locator("body").click();
    await page.keyboard.press("Meta+K");
    await expect(page.locator("[data-command-palette-overlay]")).toBeVisible();
  });

  test("/print renders all slides", async ({ page }) => {
    await page.goto("/#/print");
    const slides = page.locator(".slide-page");
    await expect(slides.first()).toBeVisible();
    expect(await slides.count()).toBeGreaterThan(40);
  });
});

test.describe("Phase 2 MDX rendering", () => {
  test("00.01 cover slide renders MDX with NoteCard + bilingual switch", async ({ page }) => {
    await page.goto("/#/s/00.01");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Claude Code Workshop");
    // Subtitle in DE
    await expect(page.locator("main")).toContainText("Augmented Working für professionelle Softwareentwicklung");
    // NoteCard hint about navigation
    await expect(page.locator("main")).toContainText("⌘K");
    // Switch to EN
    await page.getByTestId("lang-en").click();
    await expect(page.locator("main")).toContainText("Augmented Working for professional software development");
  });

  test("Speaker notes hidden by default, visible in presenter mode", async ({ page }) => {
    await page.goto("/#/s/00.01");
    await expect(page.locator("[data-speaker-notes]")).toBeHidden();
    await page.goto("/#/s/00.01?presenter=1");
    await expect(page.locator("[data-speaker-notes]")).toBeVisible();
  });
});
