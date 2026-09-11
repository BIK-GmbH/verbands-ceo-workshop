/**
 * Generate favicon + PWA icons from the FBS association logo.
 * Source: public/brand/fbs-logo.png (dark seal on transparent background).
 * Run once (or whenever the brand changes); commit the resulting files.
 */
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const BG = "#ffffff";
const LOGO = path.resolve("public/brand/fbs-logo.png");

const OUT = path.resolve("public");
mkdirSync(OUT, { recursive: true });

/** The FBS seal centred on a background tile of size×size px. */
async function tile(size, padding, radius) {
  const inner = size - 2 * padding;
  const logo = await sharp(LOGO)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/></svg>`,
  );
  return sharp(bg).composite([{ input: logo, top: padding, left: padding }]).png().toBuffer();
}

const targets = [
  { size: 192, file: "icon-192.png", padding: 14, radius: 34 },
  { size: 512, file: "icon-512.png", padding: 36, radius: 92 },
  // Maskable: full-bleed square, logo inside the 80 % safe zone
  { size: 512, file: "icon-maskable-512.png", padding: 72, radius: 0 },
  // iOS rounds the corners itself
  { size: 180, file: "apple-touch-icon.png", padding: 14, radius: 0 },
];

for (const t of targets) {
  writeFileSync(path.join(OUT, t.file), await tile(t.size, t.padding, t.radius));
  console.log(`✔ ${t.file}  (${t.size}×${t.size})`);
}

// favicon.svg wraps a 64 px PNG tile so the seal stays crisp on HiDPI tabs
const fav64 = await tile(64, 3, 12);
writeFileSync(
  path.join(OUT, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image href="data:image/png;base64,${fav64.toString("base64")}" width="64" height="64"/></svg>\n`,
);
console.log("✔ favicon.svg refreshed (FBS seal)");
