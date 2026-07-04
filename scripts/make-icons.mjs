/**
 * Rasterize the app icon SVG to the PNG sizes the PWA manifest needs, using the
 * Chromium that Playwright already installed (no image library required).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pw from "@playwright/test";

const { chromium } = pw;
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

/** A scarlet cartridge/save mark. `pad` adds a maskable safe zone. */
function icon(pad) {
  const inset = pad ? 64 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#c62d1f"/>
  <g transform="translate(${inset},${inset}) scale(${(512 - inset * 2) / 512})">
    <rect x="146" y="96" width="220" height="320" rx="26" fill="#ffffff"/>
    <rect x="146" y="96" width="220" height="70" rx="26" fill="#f2b8b1"/>
    <circle cx="256" cy="248" r="58" fill="none" stroke="#c62d1f" stroke-width="20"/>
    <rect x="176" y="330" width="160" height="18" rx="9" fill="#c62d1f"/>
    <rect x="176" y="362" width="112" height="18" rx="9" fill="#e08b82"/>
  </g>
</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>*{margin:0}</style><div style="width:${size}px;height:${size}px">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</div>`,
  );
  await page.locator("svg").screenshot({ path: path.join(outDir, file), omitBackground: true });
}

await render(icon(false), 192, "pwa-192.png");
await render(icon(false), 512, "pwa-512.png");
await render(icon(true), 512, "pwa-maskable-512.png");
await render(icon(false), 180, "apple-touch-icon.png");

await browser.close();
writeFileSync(path.resolve(outDir, "..", "favicon.svg"), icon(false));
console.log("Icons written to public/icons and public/favicon.svg");
