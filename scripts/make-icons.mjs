/**
 * Rasterize the app icon source PNG to the sizes the PWA manifest needs, using
 * the Chromium that Playwright already installed (no image library required).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pw from "@playwright/test";

const { chromium } = pw;
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });
const sourceFile = path.join(outDir, "favicon-source.png");
const sourceHref = `data:image/png;base64,${readFileSync(sourceFile, "base64")}`;

function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <image href="icons/favicon-source.png" width="512" height="512" preserveAspectRatio="xMidYMid meet" style="image-rendering:pixelated"/>
</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(size, file, options = {}) {
  const padding = options.padding ?? 0;
  const imageSize = size - padding * 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>
      html,body{margin:0;background:transparent}
      #icon{width:${size}px;height:${size}px;display:grid;place-items:center;background:transparent}
      #icon img{width:${imageSize}px;height:${imageSize}px;object-fit:contain;image-rendering:pixelated}
    </style>
    <div id="icon"><img src="${sourceHref}" alt=""></div>`,
  );
  await page.locator("img").evaluate(
    (image) =>
      image.naturalWidth > 0 ||
      new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      }),
  );
  await page.locator("#icon").screenshot({ path: path.resolve(outDir, file), omitBackground: true });
}

await render(64, "../favicon.png");
await render(192, "pwa-192.png");
await render(512, "pwa-512.png");
await render(512, "pwa-maskable-512.png", { padding: 64 });
await render(180, "apple-touch-icon.png");

await browser.close();
writeFileSync(path.resolve(outDir, "..", "favicon.svg"), `${faviconSvg()}\n`);
console.log("Icons written to public/icons and public/favicon.svg");
