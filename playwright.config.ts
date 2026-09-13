import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"]],
  // The dev server compiles 58 MDX slides plus shiki and mermaid on demand. Eight
  // workers hammering it at once starved the machine badly enough that even
  // browserContext.newPage() timed out, so the suite runs a few at a time.
  workers: 2,
  // A first paint on the cold dev server is far slower than the 30 s default allows.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
    locale: "de-DE",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  webServer: {
    // `BASE_PATH=/ npm run dev` is Unix-only syntax and fails on Windows, where this
    // project is developed. The variable belongs in `env`, which works on every platform.
    // BASE_PATH=/ serves the app at the root instead of the GitHub-Pages sub-path,
    // so `baseURL` above stays a plain host.
    command: "npm run dev -- --strictPort",
    env: { BASE_PATH: "/" },
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    // Without --strictPort vite silently falls back to 5175 when 5174 is taken, and the
    // run would then wait on a port nothing ever answers on.
    // A cold vite start measured ~55 s on this machine, so 60 s was cutting it too close.
    timeout: 180_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
