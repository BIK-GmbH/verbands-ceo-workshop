/**
 * Export the workshop deck to PDF via headless Chromium (Playwright).
 *
 * Usage:
 *   npm run export:pdf                      # outputs ./exports/workshop-de.pdf + workshop-en.pdf
 *   npm run export:pdf -- --lang=de         # only DE
 *   npm run export:pdf -- --base=/foo/      # custom base path
 *
 * The script:
 * 1. Spins up a vite preview server on port 4173
 * 2. Drives it with Playwright headless Chromium
 * 3. Visits #/print, waits for content to render
 * 4. Renders to PDF with print-optimised CSS
 */

import { chromium } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const PORT = 4173;
const HOST = `http://localhost:${PORT}`;
const OUT_DIR = path.resolve("exports");

interface Args {
  lang: "de" | "en" | "both";
  base: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  return {
    lang: (get("lang") as Args["lang"]) ?? "both",
    base: get("base") ?? "/",
  };
}

async function startPreview(base: string): Promise<ChildProcess> {
  console.log(`▶ Building (BASE_PATH=${base}) …`);
  await new Promise<void>((res, rej) => {
    const p = spawn("npm", ["run", "build"], {
      stdio: "inherit",
      shell: true, // Windows: npm is npm.cmd → needs a shell
      env: { ...process.env, BASE_PATH: base },
    });
    p.on("exit", (c) => (c === 0 ? res() : rej(new Error(`build exited ${c}`))));
  });

  console.log(`▶ Starting preview server on :${PORT} …`);
  const preview = spawn("npm", ["run", "preview", "--", "--port", String(PORT)], {
    stdio: "pipe",
    shell: true, // Windows: npm is npm.cmd → needs a shell
    env: { ...process.env, BASE_PATH: base },
  });

  // Wait for the server to respond
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(HOST);
      if (r.ok) return preview;
    } catch {
      /* not yet up */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("preview server did not come up");
}

async function exportLang(browser: Awaited<ReturnType<typeof chromium.launch>>, lang: "de" | "en") {
  const ctx = await browser.newContext({ locale: lang === "de" ? "de-DE" : "en-US" });
  // Pass the client-side login gate (see src/components/LoginGate.tsx).
  await ctx.addInitScript(() =>
    localStorage.setItem("verbands-ceo.auth.v1", "df617b21b8aee6210556bc3949b2d7c6bff8a9d53445323eb8652b70cd13cc36"),
  );
  const page = await ctx.newPage();

  // Seed the lang preference *before* we hit /print so MDX renders in the right tongue.
  await page.goto(HOST);
  await page.evaluate((l) => localStorage.setItem("workshop.lang", l), lang);

  await page.goto(`${HOST}#/print`, { waitUntil: "networkidle" });
  await page.waitForSelector(".slide-page");

  const out = path.join(OUT_DIR, `workshop-${lang}.pdf`);
  await page.pdf({
    path: out,
    format: "A4",
    printBackground: true,
    margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    preferCSSPageSize: true,
  });
  console.log(`✔ wrote ${out}`);
  await ctx.close();
}

async function main() {
  const { lang, base } = parseArgs();
  await mkdir(OUT_DIR, { recursive: true });

  const preview = await startPreview(base);
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    if (lang === "both" || lang === "de") await exportLang(browser, "de");
    if (lang === "both" || lang === "en") await exportLang(browser, "en");
  } finally {
    await browser?.close();
    preview.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
