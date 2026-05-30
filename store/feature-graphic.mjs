/**
 * Generates the Play Store feature graphic at 1024×500 PNG.
 * Run: node store/feature-graphic.mjs
 *
 * Layout: dark gradient backdrop (matches the marketing site) with the
 * brand mark on the left, "VINTRACT" wordmark + tagline next to it,
 * and a soft glow behind. Nothing too busy — Play uses this as the
 * banner on the store listing.
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "feature-graphic.png");

const W = 1024;
const H = 500;

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#070912"/>
      <stop offset="100%" stop-color="#1b0f3a"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.25" cy="0.5" r="0.55">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.85" cy="0.85" r="0.45">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <pattern id="dots" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.2" fill="rgba(167, 139, 250, 0.18)"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>

  <!-- Brand mark tile -->
  <g transform="translate(80, 195)">
    <rect width="110" height="110" rx="24" fill="url(#brand)"/>
    <path d="M16 60 L34 60 L46 22 L60 90 L72 50 L94 50"
          stroke="white" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>

  <!-- Wordmark -->
  <text x="230" y="260" fill="#ffffff"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-weight="900" font-size="72" letter-spacing="6">VINTRACT</text>

  <!-- Tagline -->
  <text x="232" y="305" fill="#c4b5fd"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-weight="600" font-size="22" letter-spacing="0.5">Industry 4.0 for the Indian factory</text>

  <!-- Sub-strap with phone icon -->
  <g transform="translate(232, 340)">
    <rect x="0" y="0" width="180" height="36" rx="18" fill="rgba(139, 92, 246, 0.22)" stroke="rgba(167, 139, 250, 0.45)" stroke-width="1"/>
    <circle cx="20" cy="18" r="4" fill="#34d399"/>
    <text x="36" y="24" fill="#ddd6fe"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          font-weight="700" font-size="13" letter-spacing="1.5">SCAN · MOVE · TRACK</text>
  </g>

  <!-- Right-side decorative circles representing scan reticle -->
  <g transform="translate(770, 250)" opacity="0.85">
    <circle r="120" fill="none" stroke="rgba(167, 139, 250, 0.25)" stroke-width="1"/>
    <circle r="80"  fill="none" stroke="rgba(167, 139, 250, 0.45)" stroke-width="1.5"/>
    <circle r="40"  fill="none" stroke="rgba(167, 139, 250, 0.7)"  stroke-width="2"/>
    <!-- corner brackets -->
    <g stroke="#a78bfa" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M -100 -100 L -100 -75 M -100 -100 L -75 -100"/>
      <path d="M  100 -100 L  100 -75 M  100 -100 L  75 -100"/>
      <path d="M -100  100 L -100  75 M -100  100 L -75  100"/>
      <path d="M  100  100 L  100  75 M  100  100 L  75  100"/>
    </g>
    <!-- centre activity glyph -->
    <path d="M-22 0 L-12 0 L-4 -20 L4 24 L12 -8 L22 -8"
          stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
</svg>
`.trim();

const out = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(OUT, out);

console.log(`Wrote ${OUT} (${out.length} bytes, ${W}x${H})`);
