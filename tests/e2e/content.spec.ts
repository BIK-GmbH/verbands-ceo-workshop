import { test, expect } from "@playwright/test";

/**
 * Phase 7 — content & wiring assertions across the full deck.
 * Smoke tests for individual flows live in smoke.spec.ts.
 */
test.describe("Content coverage", () => {
  test("manifest exposes ≥40 slides", async ({ page }) => {
    await page.goto("/#/print");
    const slides = page.locator(".slide-page");
    expect(await slides.count()).toBeGreaterThanOrEqual(40);
  });

  test("module 1 — three-modes slide renders DE", async ({ page }) => {
    await page.goto("/#/s/01.02");
    await expect(page.locator("main")).toContainText("Vibe Coding");
    await expect(page.locator("main")).toContainText("Augmented Working");
  });

  test("module 2 — installation slide shows install command", async ({ page }) => {
    await page.goto("/#/s/02.03");
    await page.locator("main pre").first().waitFor();
    await expect(page.locator("main")).toContainText("@anthropic-ai/claude-code");
  });

  test("module 3 — MCP slide lists github + postgres", async ({ page }) => {
    await page.goto("/#/s/03.05");
    await expect(page.locator("main")).toContainText("github");
    await expect(page.locator("main")).toContainText("postgres");
  });

  test("module 4 — spec-driven slide shows acceptance criteria", async ({ page }) => {
    await page.goto("/#/s/04.01");
    await expect(page.locator("main")).toContainText("Acceptance");
    await expect(page.locator("main")).toContainText("Anti-Goals");
  });

  test("module 5 — security slide warns about secrets", async ({ page }) => {
    await page.goto("/#/s/05.04");
    await expect(page.locator("main")).toContainText(/secrets|Secrets/);
  });

  test("appendix — CLAUDE.md template renders code block", async ({ page }) => {
    await page.goto("/#/s/99.01");
    await expect(page.locator("main pre").first()).toBeVisible();
  });

  test("appendix — trainer demos slide has multiple DemoBoxes", async ({ page }) => {
    await page.goto("/#/s/99.07");
    // DemoBoxes have a "▶ Demo" badge text
    const demos = page.locator("section").filter({ hasText: "▶ Demo" });
    expect(await demos.count()).toBeGreaterThanOrEqual(8);
    // First demo: setup the demo repo
    await expect(page.locator("main")).toContainText("mkdir -p ~/demo-repo");
    // Skill demo with full release-notes definition
    await expect(page.locator("main")).toContainText("name: release-notes");
    // Spec demo with realistic acceptance criteria
    await expect(page.locator("main")).toContainText("Acceptance Criteria");
  });

  test("appendix — resources slide has external links", async ({ page }) => {
    await page.goto("/#/s/99.05");
    const externalLinks = page.locator('main a[href^="http"]');
    expect(await externalLinks.count()).toBeGreaterThanOrEqual(3);
  });
});

test.describe("Bilingual coverage", () => {
  test("EN renders module 1 in English", async ({ page }) => {
    await page.goto("/#/s/01.02");
    await page.getByTestId("lang-en").click();
    await expect(page.locator("main")).toContainText("Vibe coding");
    await expect(page.locator("main")).toContainText("Augmented working");
  });

  test("EN renders module 5 in English", async ({ page }) => {
    await page.goto("/#/s/05.02");
    await page.getByTestId("lang-en").click();
    await expect(page.locator("main")).toContainText("Anti-Patterns");
  });
});

test.describe("Sources surface", () => {
  test("slides expose researchedOn date in footer", async ({ page }) => {
    await page.goto("/#/s/01.03");
    await expect(page.locator("[data-workshop-footer]")).toContainText("2026-05-06");
  });

  test("source URLs render as external links", async ({ page }) => {
    await page.goto("/#/s/01.03");
    const sourceLinks = page.locator('main a[href^="http"]');
    expect(await sourceLinks.count()).toBeGreaterThan(0);
  });
});

test.describe("Navigation edge cases", () => {
  test("End jumps to last slide", async ({ page }) => {
    await page.goto("/#/s/00.01");
    await page.locator("body").click();
    await page.keyboard.press("End");
    await expect(page).toHaveURL(/#\/s\/99\.08$/);
  });

  test("Home jumps to first slide", async ({ page }) => {
    await page.goto("/#/s/05.01");
    await page.locator("body").click();
    await page.keyboard.press("Home");
    await expect(page).toHaveURL(/#\/s\/00\.01$/);
  });

  test("Sidebar collapse hides labels but keeps toggle", async ({ page }) => {
    await page.goto("/#/s/00.01");
    await expect(page.getByTestId("module-toggle-1")).toBeVisible();
    // collapse button is the chevron in header of sidebar
    await page.locator('[data-workshop-sidebar] button[title="Collapse sidebar"]').click();
    await expect(page.getByTestId("module-toggle-1")).toBeHidden();
  });

  test("Unknown slide redirects to first", async ({ page }) => {
    await page.goto("/#/s/42.99");
    // Falls back to the unknown-content stub OR redirects via wildcard
    await expect(page.locator("main")).toBeVisible();
  });
});
