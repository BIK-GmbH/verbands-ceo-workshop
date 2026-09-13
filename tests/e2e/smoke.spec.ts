import {
  test,
  expect,
  gotoSlide,
  routeRe,
  slideInModule,
  FIRST_SLIDE,
  SECOND_SLIDE,
  LAST_SLIDE,
} from "./fixtures";

/*
 * Shell, navigation and controls. Nothing here asserts on wording that the workshop
 * preparation may still change — only on structure that the app must always provide.
 *
 * Keystrokes are sent without clicking first: a click lands in the centre of the slide,
 * which on many slides is a WorkshopInput, and the keymap ignores keys typed into inputs.
 * After a navigation the body holds focus, which is exactly what the keymap listens on.
 */

test.describe("App shell", () => {
  test("landing page links into the deck at the manifest's first slide", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(`a[href="#/s/${FIRST_SLIDE}"]`).first()).toBeVisible();
  });

  test("deck renders header, sidebar, footer and a heading", async ({ page }) => {
    await page.goto(`/#/s/${FIRST_SLIDE}`);
    await expect(page.locator("[data-workshop-header]")).toBeVisible();
    await expect(page.locator("[data-workshop-sidebar]")).toBeVisible();
    await expect(page.locator("[data-workshop-footer]")).toBeVisible();
    await expect(page.locator("[data-workshop-content] h1").first()).not.toBeEmpty();
  });
});

test.describe("Navigation", () => {
  test("ArrowRight advances to the next slide", async ({ page }) => {
    await gotoSlide(page, FIRST_SLIDE);
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(routeRe("s", SECOND_SLIDE));
  });

  test("ArrowLeft goes back", async ({ page }) => {
    await gotoSlide(page, SECOND_SLIDE);
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(routeRe("s", FIRST_SLIDE));
  });

  test("Home jumps to the manifest's first slide", async ({ page }) => {
    await gotoSlide(page, slideInModule(5));
    await page.keyboard.press("Home");
    await expect(page).toHaveURL(routeRe("s", FIRST_SLIDE));
  });

  test("End jumps to the manifest's last slide", async ({ page }) => {
    await gotoSlide(page, FIRST_SLIDE);
    await page.keyboard.press("End");
    await expect(page).toHaveURL(routeRe("s", LAST_SLIDE));
  });

  test("a sidebar entry navigates to its slide", async ({ page }) => {
    const target = slideInModule(1);
    await page.goto(`/#/s/${FIRST_SLIDE}`);
    await page.getByTestId("module-toggle-1").click();
    await page.getByTestId(`slide-link-${target}`).click();
    await expect(page).toHaveURL(routeRe("s", target));
  });

  test("the sidebar collapses and keeps its toggle", async ({ page }) => {
    await page.goto(`/#/s/${FIRST_SLIDE}`);
    await expect(page.getByTestId("module-toggle-0")).toBeVisible();
    await page.locator('[data-workshop-sidebar] button[aria-label="Collapse sidebar"]').click();
    await expect(page.getByTestId("module-toggle-0")).toHaveCount(0);
    const collapsed = page.locator('[data-workshop-sidebar][data-collapsed="1"]');
    await expect(collapsed).toBeVisible();
    await expect(collapsed.locator('button[aria-label="Expand sidebar"]')).toBeVisible();
  });

  test("an unknown slide id does not break the app", async ({ page }) => {
    await page.goto("/#/s/42.99");
    await expect(page.locator("[data-workshop-content]")).toBeVisible();
    await expect(page.locator("[data-workshop-content] h1").first()).toBeVisible();
  });
});

test.describe("Controls", () => {
  test("the header offers the central controls", async ({ page }) => {
    await page.goto(`/#/s/${FIRST_SLIDE}`);
    const header = page.locator("[data-workshop-header]");
    await expect(header.getByTestId("open-protocol")).toBeVisible();
    await expect(header.locator('a[href="#/poster"]')).toBeVisible();
    await expect(header.locator('a[href="#/interviews"]')).toBeVisible();
    await expect(header.locator('a[href="#/einstellungen"]')).toBeVisible();
    await expect(header.getByTestId("enter-presentation")).toBeVisible();
    await expect(page.locator('[data-workshop-footer] a[href="#/print"]')).toBeVisible();
  });

  test("the theme toggle flips data-theme", async ({ page }) => {
    await page.goto(`/#/s/${FIRST_SLIDE}`);
    const html = page.locator("html");
    const before = await html.getAttribute("data-theme");
    await page.getByTestId("theme-toggle").click();
    expect(await html.getAttribute("data-theme")).not.toBe(before);
  });

  test("the language toggle switches the interface language", async ({ page }) => {
    await page.goto(`/#/s/${FIRST_SLIDE}`);
    await page.getByTestId("lang-en").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByTestId("lang-de").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
  });

  test("the command palette opens by keyboard", async ({ page }) => {
    await gotoSlide(page, FIRST_SLIDE);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.locator("[data-command-palette-overlay]")).toBeVisible();
  });
});
