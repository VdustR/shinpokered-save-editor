/**
 * Play through the Shin Pokémon Red intro in a headless emulator and save
 * in-game, producing a genuine battery save as a committed test fixture.
 *
 * Usage: SHINPOKERED_ROM=/path/to/rom.gb node scripts/make-fixture.mjs
 *
 * The ROM itself is never committed; only the save (player-generated data) is.
 * Timing was reverse-engineered against shinpokered engine/oak_speech.asm:
 * after Oak's final line, one A press triggers the shrink animation and an
 * automatic fade to the bedroom — no further input, or it interferes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Driver, KEYMAP, WRAM, decodeGen1Text } from "./emulator.mjs";

const romPath = process.env.SHINPOKERED_ROM;
if (!romPath) {
  console.error("Set SHINPOKERED_ROM to the Shin Pokémon Red ROM path.");
  process.exit(1);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(rootDir, "tests", "fixtures", "newgame.sav");

const gb = new Driver(romPath);
const hasDialog = () => gb.screenText().includes("┌") || gb.screenText().includes("└");
const inBedroom = () => gb.screenRows()[0].startsWith("ヂ") && !hasDialog();

console.log("Booting to title…");
gb.steps(240);
for (let i = 0; i < 120 && !gb.screenText().includes("NEW GAME"); i++) {
  gb.tap(KEYMAP.START, 20);
  if (gb.screenText().includes("NEW GAME")) break;
  gb.tap(KEYMAP.A, 20);
}
gb.waitForText("NEW GAME", { timeout: 600 });
console.log(`Title menu reached at frame ${gb.frame}.`);
gb.chooseMenuEntry("NEW GAME");

console.log("Naming the player RED…");
gb.advanceDialogUntil(() => gb.screenText().includes("NEW NAME"), { label: "player name menu" });
gb.chooseMenuEntry("RED");

console.log("Naming the rival BLUE…");
gb.advanceDialogUntil(
  () => gb.screenText().includes("NEW NAME") && gb.screenRows().some((row) => row.includes("BLUE")),
  { label: "rival name menu" },
);
gb.chooseMenuEntry("BLUE");

console.log("Advancing Oak's speech to its final line…");
gb.advanceDialogUntil(() => gb.screenText().includes("Let") && gb.screenText().includes("go"), {
  label: "end of Oak speech",
  timeout: 12000,
});

console.log("Dismissing final line and waiting for bedroom control…");
gb.tap(KEYMAP.A, 4);
gb.waitFor("bedroom control", inBedroom, { timeout: 2000, interval: 6, keys: [] });
gb.steps(60); // let the map settle
const name = decodeGen1Text(gb.readBytes(WRAM.playerName, 11));
if (name !== "RED") {
  throw new Error(`Unexpected player name in WRAM: ${JSON.stringify(name)}\n${gb.screenText()}`);
}
console.log(`Bedroom reached at frame ${gb.frame}; player name = ${name}.`);

console.log("Opening menu and saving…");
gb.steps(6, [KEYMAP.START]); // hold START long enough for the overworld handler
gb.waitForText("SAVE", { timeout: 600 });
gb.chooseMenuEntry("SAVE");
// The confirm box types out "Would you like to SAVE the game?" then shows a
// YES/NO menu (cursor defaults to YES). Press A on a slow cadence: fast enough
// to confirm YES once the menu is interactive, slow enough that we notice the
// "saved the game" message before the next A would dismiss it.
// "<PLAYER> saved" / "the game!" spans two lines; the lowercase "saved" only
// appears in the confirmation (the question uses uppercase "SAVE").
let saved = false;
for (let i = 0; i < 40 && !saved; i++) {
  if (gb.screenText().includes("saved")) {
    saved = true;
    break;
  }
  gb.tap(KEYMAP.A, 22);
}
if (!saved) {
  throw new Error(`Save was not confirmed.\n${gb.screenText()}`);
}
gb.steps(300); // let the SRAM write settle

const save = gb.saveData();
if (save.length < 0x8000) {
  throw new Error(`Save data too small: ${save.length}`);
}
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, save.subarray(0, 0x8000));
console.log(`Wrote ${outPath} (32768 bytes) after ${gb.frame} frames.`);
