/**
 * Download the 151 Gen 1 (Red/Blue) Pokémon sprites into public/sprites/.
 *
 * Sprites are © Nintendo / Creatures / GAME FREAK and are NOT committed to the
 * repository (public/sprites is gitignored). Run this once locally; the PWA
 * then precaches them for offline use.
 *
 * Usage: node scripts/fetch-sprites.mjs
 */
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-i/red-blue/transparent";
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "sprites");
mkdirSync(outDir, { recursive: true });

let downloaded = 0;
let skipped = 0;
for (let dex = 1; dex <= 151; dex++) {
  const dest = path.join(outDir, `${dex}.png`);
  if (existsSync(dest)) {
    skipped += 1;
    continue;
  }
  const res = await fetch(`${BASE}/${dex}.png`);
  if (!res.ok) throw new Error(`Failed to fetch sprite ${dex}: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  writeFileSync(dest, buf);
  downloaded += 1;
}
console.log(`Sprites ready in public/sprites (${downloaded} downloaded, ${skipped} already present).`);
