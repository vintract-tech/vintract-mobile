/**
 * Generates the full Vintract app icon set required by Expo + Android.
 * Run: node store/icons.mjs
 *
 * Outputs into ../assets/:
 *   icon.png                          1024×1024 — main launcher icon (rounded gradient + activity glyph)
 *   adaptive-icon.png                 1024×1024 — same as icon, used as Android adaptive foreground fallback
 *   android-icon-foreground.png       1024×1024 — adaptive foreground (glyph centered, 432dp safe zone)
 *   android-icon-background.png       1024×1024 — adaptive background (solid gradient)
 *   android-icon-monochrome.png       1024×1024 — themed-icon monochrome (white-on-transparent glyph)
 *   favicon.png                       64×64    — web favicon
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, "..", "assets");

const SIZE = 1024;

/**
 * Vintract brand mark — purple→green gradient rounded square with the
 * activity-line glyph in white. Used everywhere (favicon, OG image,
 * feature graphic, app icon).
 */
function brandIcon(size) {
  const r = size * 0.22;       // corner radius — softens the square
  // Glyph viewBox is 0..32; we scale it to fill the canvas with a margin.
  const margin = size * 0.18;
  const inner = size - margin * 2;
  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <g transform="translate(${margin}, ${margin})">
    <path
      d="M ${inner * (5/32)} ${inner * (17/32)}
         L ${inner * (10/32)} ${inner * (17/32)}
         L ${inner * (13/32)} ${inner * (7/32)}
         L ${inner * (17/32)} ${inner * (24/32)}
         L ${inner * (20/32)} ${inner * (14/32)}
         L ${inner * (27/32)} ${inner * (14/32)}"
      stroke="white"
      stroke-width="${inner * 0.085}"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
  </g>
</svg>`.trim();
}

/**
 * Adaptive foreground — the glyph on a TRANSPARENT background.
 * Android takes this layer and composes it over the separate
 * background layer, with masks (circle / squircle / squircle) applied
 * by the launcher. The "safe zone" is the centre 66% of the canvas;
 * the glyph must fit inside that, with margins.
 */
function adaptiveForeground(size) {
  const safeRatio = 0.66;
  const margin = (size * (1 - safeRatio)) / 2 + size * 0.06; // safe zone + a bit more
  const inner = size - margin * 2;
  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${margin}, ${margin})">
    <path
      d="M ${inner * (5/32)} ${inner * (17/32)}
         L ${inner * (10/32)} ${inner * (17/32)}
         L ${inner * (13/32)} ${inner * (7/32)}
         L ${inner * (17/32)} ${inner * (24/32)}
         L ${inner * (20/32)} ${inner * (14/32)}
         L ${inner * (27/32)} ${inner * (14/32)}"
      stroke="white"
      stroke-width="${inner * 0.10}"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
  </g>
</svg>`.trim();
}

/**
 * Adaptive background — solid gradient that fills the entire canvas.
 * No glyph, no margins; Android masks this with the launcher's shape.
 */
function adaptiveBackground(size) {
  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
</svg>`.trim();
}

/**
 * Monochrome — for Android's themed icons feature. Glyph in a single
 * fill, on transparent. Android applies its own tint to it.
 */
function adaptiveMonochrome(size) {
  const safeRatio = 0.66;
  const margin = (size * (1 - safeRatio)) / 2 + size * 0.06;
  const inner = size - margin * 2;
  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${margin}, ${margin})">
    <path
      d="M ${inner * (5/32)} ${inner * (17/32)}
         L ${inner * (10/32)} ${inner * (17/32)}
         L ${inner * (13/32)} ${inner * (7/32)}
         L ${inner * (17/32)} ${inner * (24/32)}
         L ${inner * (20/32)} ${inner * (14/32)}
         L ${inner * (27/32)} ${inner * (14/32)}"
      stroke="white"
      stroke-width="${inner * 0.10}"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
  </g>
</svg>`.trim();
}

async function writePng(svg, outPath, size = SIZE) {
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath} (${buf.length} bytes)`);
}

await writePng(brandIcon(SIZE),          resolve(ASSETS, "icon.png"));
await writePng(brandIcon(SIZE),          resolve(ASSETS, "adaptive-icon.png"));
await writePng(adaptiveForeground(SIZE), resolve(ASSETS, "android-icon-foreground.png"));
await writePng(adaptiveBackground(SIZE), resolve(ASSETS, "android-icon-background.png"));
await writePng(adaptiveMonochrome(SIZE), resolve(ASSETS, "android-icon-monochrome.png"));
await writePng(brandIcon(64),            resolve(ASSETS, "favicon.png"), 64);

console.log("All icons written to assets/");
