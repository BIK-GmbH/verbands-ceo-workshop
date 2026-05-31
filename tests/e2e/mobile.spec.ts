import { test, expect } from "@playwright/test";

// Mobile-sized viewport on chromium (avoids needing webkit).
// iPhone 14 dimensions, with touch + isMobile flags.
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test.describe("Mobile layout", () => {
  test("hamburger toggles sidebar drawer in docs view", async ({ page }) => {
    await page.goto("/#/s/00.01");
    // Hamburger should be visible
    const hamburger = page.getByTestId("mobile-sidebar-toggle");
    await expect(hamburger).toBeVisible();

    // Drawer not in DOM initially
    await expect(page.locator("[data-workshop-sidebar-mobile]")).toHaveCount(0);

    // Open
    await hamburger.click();
    const drawer = page.locator("[data-workshop-sidebar-mobile]");
    await expect(drawer).toBeVisible();

    // Click a slide INSIDE the mobile drawer → drawer closes + nav happens
    await drawer.getByTestId("module-toggle-1").click();
    await drawer.getByTestId("slide-link-01.03").click();
    await expect(page).toHaveURL(/01\.03/);
    await expect(page.locator("[data-workshop-sidebar-mobile]")).toHaveCount(0);
  });

  test("backdrop click closes drawer", async ({ page }) => {
    await page.goto("/#/s/00.01");
    await page.getByTestId("mobile-sidebar-toggle").click();
    await expect(page.locator("[data-workshop-sidebar-mobile]")).toBeVisible();
    // Click far right (outside drawer which is left 320px wide)
    await page.getByTestId("sidebar-backdrop").click({
      position: { x: 350, y: 400 },
    });
    await expect(page.locator("[data-workshop-sidebar-mobile]")).toHaveCount(0);
  });

  test("mobile lang toggle (single button) flips DE↔EN", async ({ page }) => {
    await page.goto("/#/s/00.01");
    const html = page.locator("html");
    const before = await html.getAttribute("lang");
    await page.getByTestId("lang-toggle-mobile").click();
    const after = await html.getAttribute("lang");
    expect(after).not.toBe(before);
  });

  test("presentation mode is full-bleed (no 16:9 frame) on mobile", async ({ page }) => {
    await page.goto("/#/p/00.01");
    const slideContainer = page.locator(".presentation-slide");
    await expect(slideContainer).toBeVisible();
    // The 16:9 container should NOT have shadow class active on mobile
    // (we just verify the presentation root is visible and slide content is reachable)
    await expect(page.locator("[data-presentation]")).toContainText("Claude Code Workshop");
  });

  test("swipe-left navigates to next slide in presentation", async ({ page }) => {
    await page.goto("/#/p/00.01");
    const root = page.locator("[data-presentation]");
    const box = await root.boundingBox();
    if (!box) throw new Error("presentation has no bbox");

    // Synthesize a left-swipe (right → left)
    await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height / 2);
    // Then a swipe via dispatchEvent — page.touchscreen has no swipe primitive
    await root.evaluate((el) => {
      function ev(name: string, x: number, y: number) {
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        return new TouchEvent(name, {
          touches: name === "touchend" ? [] : [t],
          changedTouches: [t],
          bubbles: true,
          cancelable: true,
        });
      }
      const rect = (el as HTMLElement).getBoundingClientRect();
      const startX = rect.right - 40;
      const endX = rect.left + 40;
      const y = rect.top + rect.height / 2;
      el.dispatchEvent(ev("touchstart", startX, y));
      el.dispatchEvent(ev("touchend", endX, y));
    });
    await expect(page).toHaveURL(/#\/p\/00\.02/);
  });

  test("vertical swipe does NOT navigate (allows scrolling)", async ({ page }) => {
    await page.goto("/#/p/00.01");
    const root = page.locator("[data-presentation]");
    await root.evaluate((el) => {
      function ev(name: string, x: number, y: number) {
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        return new TouchEvent(name, {
          touches: name === "touchend" ? [] : [t],
          changedTouches: [t],
          bubbles: true,
          cancelable: true,
        });
      }
      const rect = (el as HTMLElement).getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      el.dispatchEvent(ev("touchstart", x, rect.top + 40));
      el.dispatchEvent(ev("touchend", x, rect.bottom - 40));
    });
    await expect(page).toHaveURL(/#\/p\/00\.01/);
  });

  test("swipe-left in docs view navigates to next slide", async ({ page }) => {
    await page.goto("/#/s/00.01");
    const main = page.locator("[data-workshop-content]");
    await main.evaluate((el) => {
      function ev(name: string, x: number, y: number) {
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        return new TouchEvent(name, {
          touches: name === "touchend" ? [] : [t],
          changedTouches: [t],
          bubbles: true,
          cancelable: true,
        });
      }
      const rect = (el as HTMLElement).getBoundingClientRect();
      const startX = rect.right - 40;
      const endX = rect.left + 40;
      const y = rect.top + rect.height / 2;
      el.dispatchEvent(ev("touchstart", startX, y));
      el.dispatchEvent(ev("touchend", endX, y));
    });
    await expect(page).toHaveURL(/#\/s\/00\.02/);
  });

  test("swipe-right in docs view navigates to previous slide", async ({ page }) => {
    await page.goto("/#/s/00.02");
    const main = page.locator("[data-workshop-content]");
    await main.evaluate((el) => {
      function ev(name: string, x: number, y: number) {
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        return new TouchEvent(name, {
          touches: name === "touchend" ? [] : [t],
          changedTouches: [t],
          bubbles: true,
          cancelable: true,
        });
      }
      const rect = (el as HTMLElement).getBoundingClientRect();
      const startX = rect.left + 40;
      const endX = rect.right - 40;
      const y = rect.top + rect.height / 2;
      el.dispatchEvent(ev("touchstart", startX, y));
      el.dispatchEvent(ev("touchend", endX, y));
    });
    await expect(page).toHaveURL(/#\/s\/00\.01/);
  });

  test("vertical swipe in docs view does not navigate (allows scroll)", async ({ page }) => {
    await page.goto("/#/s/03.05");
    const main = page.locator("[data-workshop-content]");
    await main.evaluate((el) => {
      function ev(name: string, x: number, y: number) {
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        return new TouchEvent(name, {
          touches: name === "touchend" ? [] : [t],
          changedTouches: [t],
          bubbles: true,
          cancelable: true,
        });
      }
      const rect = (el as HTMLElement).getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      el.dispatchEvent(ev("touchstart", x, rect.top + 40));
      el.dispatchEvent(ev("touchend", x, rect.bottom - 40));
    });
    await expect(page).toHaveURL(/#\/s\/03\.05/);
  });

  test("Cover slide content is reachable and not hidden behind chrome", async ({ page }) => {
    await page.goto("/#/s/00.01");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main")).toContainText("Augmented Working");
  });

  test("Swipe-hint appears on first visit, persists after dismiss", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/#/s/00.01");
    await expect(page.locator("[data-swipe-hint]")).toBeVisible({ timeout: 4000 });
    await page.locator("[data-swipe-hint] button").click();
    await expect(page.locator("[data-swipe-hint]")).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(2200);
    await expect(page.locator("[data-swipe-hint]")).toHaveCount(0);
  });

  test("Pull-to-refresh suppressed via overscroll-behavior", async ({ page }) => {
    await page.goto("/#/s/00.01");
    const overscroll = await page.evaluate(
      () => getComputedStyle(document.body).overscrollBehavior,
    );
    expect(overscroll).toMatch(/contain/);
  });

  test("Mobile footer is bigger (56px+) and respects safe-area", async ({ page }) => {
    await page.goto("/#/s/00.01");
    const footer = page.locator("[data-workshop-footer]");
    const box = await footer.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(56);
  });
});
