import {
  test,
  expect,
  collectPageErrors,
  SLIDE_IDS,
  SLIDE_COUNT,
} from "./fixtures";

/*
 * Deck-wide coverage. Everything here is derived from the manifest, so rewriting a
 * slide's wording never breaks these tests — only removing a slide or breaking one does.
 */

test.describe("Deck coverage", () => {
  test("every slide renders a heading and raises no errors", async ({ page }) => {
    // Every slide is compiled by the dev server the first time it is requested.
    test.setTimeout(300_000);
    const errors = collectPageErrors(page);
    const broken: string[] = [];

    // Warm up once — the first load pulls in React, shiki and mermaid and is by far
    // the slowest navigation of the run.
    await page.goto(`/#/s/${SLIDE_IDS[0]}`);
    await page
      .locator("[data-workshop-content] h1")
      .first()
      .waitFor({ state: "visible", timeout: 90_000 });

    const content = page.locator("[data-workshop-content]");

    for (const id of SLIDE_IDS) {
      try {
        await page.goto(`/#/s/${id}`);
        // Hash navigation keeps React mounted, so the previous slide's heading stays on
        // screen for a moment. Waiting for this slide's own id badge is what proves the
        // new slide actually rendered — without it a stale heading would satisfy the check.
        await expect(content).toContainText(id, { timeout: 30_000 });
        const text = (await content.locator("h1").first().textContent())?.trim() ?? "";
        if (text.length === 0) broken.push(`${id}: empty heading`);
      } catch {
        broken.push(`${id}: did not render`);
      }
    }

    expect(broken, "slides without a usable heading").toEqual([]);
    expect(errors, "console errors / uncaught exceptions across the deck").toEqual([]);
  });
});

test.describe("Bilingual coverage", () => {
  // 02.09 has a heading that is unambiguous in both languages and is core to the
  // workshop's argument, so it is a safe anchor for the language switch.
  test("language switch translates the slide heading", async ({ page }) => {
    await page.goto("/#/s/02.09");
    const heading = page.locator("[data-workshop-content] h1").first();
    await expect(heading).toHaveText("Wissen als Grundlage");

    await page.getByTestId("lang-en").click();
    await expect(heading).toHaveText("Knowledge as the foundation");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("Manifest wiring", () => {
  test("sidebar lists every slide the manifest declares", async ({ page }) => {
    await page.goto(`/#/s/${SLIDE_IDS[0]}`);
    const sidebar = page.locator("[data-workshop-sidebar]");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator("[data-testid^='slide-link-']")).toHaveCount(
      SLIDE_COUNT,
    );
  });
});
