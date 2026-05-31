/**
 * Generate PWA icons from the real BIK logo SVG.
 * Source: public/brand/bik-logo-white.svg (downloaded from bik.biz)
 * Run once (or whenever the brand changes); commit the resulting PNGs.
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const BG = "#181A27";          // BIK Anthrazit
const BG_LIGHT = "#38B6AB";    // BIK Türkis (alternative if needed)

const OUT = path.resolve("public");
mkdirSync(OUT, { recursive: true });

const logoSvg = readFileSync(path.resolve("public/brand/bik-logo-white.svg"), "utf8");

/** Wrap the BIK logo in a coloured background tile of size×size px. */
function tile(size, padding, withBg) {
  const inner = size - 2 * padding;
  const bg = withBg
    ? `<rect width="${size}" height="${size}" rx="${size * 0.18}" fill="${BG}"/>`
    : "";
  // Embed the logo as data URI so we don't have to inline-merge SVG nodes.
  const logoB64 = Buffer.from(logoSvg).toString("base64");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  ${bg}
  <image href="data:image/svg+xml;base64,${logoB64}"
         x="${padding}" y="${padding}" width="${inner}" height="${inner}"/>
</svg>`;
}

const targets = [
  { size: 192, file: "icon-192.png", padding: 24, withBg: true },
  { size: 512, file: "icon-512.png", padding: 64, withBg: true },
  // Maskable: 80%-safe-zone, give more padding so the logo sits inside it
  { size: 512, file: "icon-maskable-512.png", padding: 110, withBg: true },
  { size: 180, file: "apple-touch-icon.png", padding: 22, withBg: true },
];

for (const t of targets) {
  const buf = await sharp(Buffer.from(tile(t.size, t.padding, t.withBg)))
    .png()
    .toBuffer();
  writeFileSync(path.join(OUT, t.file), buf);
  console.log(`✔ ${t.file}  (${t.size}×${t.size})`);
}

// Refresh favicon.svg with a small BIK tile (logo on Anthrazit background)
const fav = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="${BG}"/>
  <image href="data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}"
         x="3" y="3" width="26" height="26"/>
</svg>`;
writeFileSync(path.join(OUT, "favicon.svg"), fav);
console.log("✔ favicon.svg refreshed (BIK logo on Anthrazit)");
