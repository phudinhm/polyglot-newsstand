/**
 * Draws the app icon and writes every size the platforms ask for.
 *
 * The mark is a folded newspaper with the N cut out of it: the fold runs down
 * the page and passes across the letter, so the two are locked together rather
 * than sitting side by side. Everything is geometry rather than a font, so it
 * renders identically wherever it lands, and the letter stays readable at the
 * 20px the browser tab gives it.
 *
 * Run with `npm run icons` after changing anything below.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CREAM = "#FFFDF9";
const INK = "#D36C4F";
const PUBLIC = join(process.cwd(), "public");

/** The mark itself, drawn in a 64x64 box. */
const mark = `
  <g transform="rotate(-3 32 32)">
    <g mask="url(#noN)" clip-path="url(#sheet)">
      <rect width="64" height="64" fill="${CREAM}"/>
      <rect x="32" width="32" height="64" fill="#F4EFEA"/>
      <path d="M54.5 47 L48.5 53 L48.5 47 Z" fill="#E8DFD5"/>
      <path d="M16.5 15.4 H47.5 M16.5 18.4 H37" stroke="${INK}" stroke-opacity="0.38"
            stroke-width="1.6" stroke-linecap="round"/>
      <path d="M16.5 50.6 H44" stroke="${INK}" stroke-opacity="0.28"
            stroke-width="1.5" stroke-linecap="round"/>
    </g>
    <g clip-path="url(#sheet)">
      <rect x="30.9" y="11" width="2.1" height="42" fill="${CREAM}"/>
      <rect x="33" y="11" width="1.1" height="42" fill="${INK}" fill-opacity="0.2"/>
    </g>
  </g>`;

const defs = `
  <defs>
    <linearGradient id="bg" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#E27D60"/>
      <stop offset="0.55" stop-color="${INK}"/>
      <stop offset="1" stop-color="#BA5236"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="sheet">
      <path d="M12.5 11 H51.5 a3 3 0 0 1 3 3 V47 L48.5 53 H12.5 a3 3 0 0 1 -3 -3 V14 a3 3 0 0 1 3 -3 Z"/>
    </clipPath>
    <mask id="noN">
      <rect width="64" height="64" fill="#fff"/>
      <path d="M15.5 21 H23 L41 36.5 V21 H48.5 V47 H41 L23 30.5 V47 H15.5 Z" fill="#000"/>
    </mask>
  </defs>`;

/**
 * The rounded tile every platform except Android draws. Android applies its own
 * mask, so the maskable variant runs the background to the edge and pulls the
 * mark into the inner 80% that is guaranteed to survive the crop.
 */
function icon({ maskable = false } = {}) {
  const radius = maskable ? 0 : 15.04;
  const body = maskable
    ? `<g transform="translate(32 32) scale(0.76) translate(-32 -32)">${mark}</g>`
    : `${mark}`;
  const rim = maskable
    ? ""
    : `<rect x="0.77" y="0.77" width="62.46" height="62.46" rx="14.27" fill="none"
             stroke="#ffffff" stroke-opacity="0.16" stroke-width="1.02"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${defs}
  <rect width="64" height="64" rx="${radius}" fill="url(#bg)"/>
  <rect width="64" height="64" rx="${radius}" fill="url(#sheen)"/>
  ${rim}
  ${body}
</svg>`;
}

const OUTPUTS = [
  { file: "favicon-32.png", size: 32 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
];

writeFileSync(join(PUBLIC, "icon.svg"), `${icon()}\n`);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage();
for (const { file, size, maskable } of OUTPUTS) {
  const svg = icon({ maskable }).replace('width="64" height="64"', `width="${size}" height="${size}"`);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: join(PUBLIC, file), omitBackground: true });
  console.log(`  ${file} (${size}px)`);
}
await browser.close();
console.log("\nIcons written to public/\n");
