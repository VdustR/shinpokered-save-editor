import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// https://vite.dev/config/
export default defineConfig({
  // Served from the domain root locally; GitHub Pages sets VITE_BASE to the
  // project subpath (e.g. "/shinpokered-save-editor/") so assets resolve.
  base: process.env.VITE_BASE || "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Shin Pokémon Save Editor",
        short_name: "Shin Save",
        description:
          "Local-first save editor for the Shin Pokémon series (Red/Blue/Green) and vanilla Gen 1 battery saves.",
        theme_color: "#c62d1f",
        background_color: "#111417",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icons/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the app shell plus the Gen 1 sprites so it works fully offline.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // 151 sprites + bundle stay well under the default file-count budget,
        // but raise the size cap so nothing is silently skipped.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
