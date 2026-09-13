import {
  test,
  expect,
  gotoPresentation,
  routeRe,
  FIRST_SLIDE,
  SECOND_SLIDE,
  SLIDE_COUNT,
  SLIDE_IDS,
} from "./fixtures";

test.describe("Presentation mode", () => {
  test("entering from the header switches to /p/:slideId", async ({ page }) => {
    await page.goto(`/#/s/${SECOND_SLIDE}`);
    await page.getByTestId("enter-presentation").click();
    await expect(page).toHaveURL(routeRe("p", SECOND_SLIDE));
    await expect(page.locator("[data-presentation]")).toBeVisible();
    // The sidebar must be gone in presentation mode.
    await expect(page.locator("[data-workshop-sidebar]")).toHaveCount(0);
  });

  test("ArrowRight navigates between presentation slides", async ({ page }) => {
    await gotoPresentation(page, FIRST_SLIDE);
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(routeRe("p", SECOND_SLIDE));
  });

  test("Esc exits to the working view of the same slide", async ({ page }) => {
    const id = SLIDE_IDS[3];
    await gotoPresentation(page, id);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(routeRe("s", id));
    await expect(page.locator("[data-workshop-sidebar]")).toBeVisible();
  });

  test("N toggles the speaker notes", async ({ page }) => {
    await gotoPresentation(page, FIRST_SLIDE);
    const notes = page.locator("[data-speaker-notes]");
    await expect(notes).toBeHidden();
    await page.keyboard.press("n");
    await expect(notes).toBeVisible();
    await page.keyboard.press("n");
    await expect(notes).toBeHidden();
  });

  test("the counter reflects the manifest length", async ({ page }) => {
    await page.goto(`/#/p/${FIRST_SLIDE}`);
    await expect(page.locator("[data-presentation]")).toContainText(
      `1 / ${SLIDE_COUNT}`,
    );
  });
});
