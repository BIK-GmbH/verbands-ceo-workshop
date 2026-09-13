import { test as base, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/*
 * Shared test setup.
 *
 * Two jobs:
 *  1. Get past the client-side login gate once, for every test.
 *  2. Derive the deck's shape (slide count, first/last id) from the manifest instead
 *     of hard-coding it, so the suite follows the deck when slides are added or moved.
 */

// Mirrors src/components/LoginGate.tsx. The gate compares a SHA-256 of "user:password"
// against this value, so writing the hash straight into localStorage signs us in
// without ever typing credentials.
const AUTH_STORAGE_KEY = "verbands-ceo.auth.v1";
const AUTH_HASH = "df617b21b8aee6210556bc3949b2d7c6bff8a9d53445323eb8652b70cd13cc36";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_FILE = path.resolve(HERE, "../../src/lib/manifest.ts");

/** Slide ids in deck order, read as plain text out of the single source of truth. */
function readSlideIds(): string[] {
  const source = readFileSync(MANIFEST_FILE, "utf8");
  const ids = [...source.matchAll(/\bid:\s*"(\d{2}\.\d{2})"/g)].map((m) => m[1]);
  if (ids.length === 0) {
    throw new Error(
      `No slide ids found in ${MANIFEST_FILE}. Did the manifest format change?`,
    );
  }
  return ids;
}

export const SLIDE_IDS = readSlideIds();
export const SLIDE_COUNT = SLIDE_IDS.length;
export const FIRST_SLIDE = SLIDE_IDS[0];
export const LAST_SLIDE = SLIDE_IDS[SLIDE_COUNT - 1];
export const SECOND_SLIDE = SLIDE_IDS[1];

/** A slide id from the given module, for tests that need to click through the sidebar. */
export function slideInModule(moduleIndex: number): string {
  const prefix = `${String(moduleIndex).padStart(2, "0")}.`;
  const id = SLIDE_IDS.find((s) => s.startsWith(prefix));
  if (!id) throw new Error(`Manifest has no slide in module ${moduleIndex}`);
  return id;
}

/** Hash-route matcher — slide ids contain a dot that must not act as a wildcard. */
export function routeRe(prefix: "s" | "p", id: string): RegExp {
  return new RegExp(`#/${prefix}/${id.replace(/\./g, "\\.")}$`);
}

/*
 * Console noise that says nothing about the deck being broken:
 *  - the PWA service worker is disabled in dev, so its registration warning is expected
 *  - a missing favicon in the dev server is not a deck defect
 */
const IGNORED_CONSOLE = [/\[pwa\]/i, /favicon/i];

/**
 * Records console errors and uncaught exceptions. Call at the start of a test and
 * assert the array is empty at the end.
 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

/*
 * Navigate and wait until the deck is actually interactive.
 *
 * `page.goto` resolves on the "load" event, but this is a dev-server SPA: React mounts
 * and registers its window keydown listener well after that. A key pressed in between is
 * simply lost. Waiting for the rendered heading proves React has committed the layout,
 * and with it the keymap effect.
 */
export async function gotoSlide(page: Page, id: string): Promise<void> {
  await page.goto(`/#/s/${id}`);
  await page.locator("[data-workshop-content] h1").first().waitFor({ state: "visible" });
}

export async function gotoPresentation(page: Page, id: string): Promise<void> {
  await page.goto(`/#/p/${id}`);
  await page.locator(".presentation-slide h1").first().waitFor({ state: "visible" });
}

/** Every test runs already signed in — the hash is set before the app's first script runs. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(
      ([key, value]: [string, string]) => window.localStorage.setItem(key, value),
      [AUTH_STORAGE_KEY, AUTH_HASH] as [string, string],
    );
    await use(page);
  },
});

export { expect };
