/**
 * Emulator smoke test — the release gate the spec calls for.
 *
 * Edits the fixture save through the real save-core (money + a party
 * Bulbasaur), exports it, then boots the ROM with that save in a headless
 * emulator, chooses CONTINUE, reaches the overworld, and asserts the game's
 * own WRAM reflects the edits. This proves the writer produces saves the game
 * actually loads, not just files that parse.
 *
 * Usage: SHINPOKERED_ROM=/path/to/rom.gb pnpm smoke
 * Exits 0 on success, 1 on failure, 2 if the ROM is not provided (skipped).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error - plain JS helper module, no type declarations
import { Driver, KEYMAP, WRAM, decodeGen1Text } from "./emulator.mjs";
import { createMon } from "../src/save/derive";
import { DEX_SPECIES, speciesByInternalId } from "../src/save/gamedata";
import { exportSave, getMoney, getParty, parseSave, setMoney, setPartyMon } from "../src/save/savefile";

const romPath = process.env.SHINPOKERED_ROM;
if (!romPath) {
  console.log("SKIP: set SHINPOKERED_ROM to run the emulator smoke test.");
  process.exit(2);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EDIT_MONEY = 456789;
const BULBASAUR = DEX_SPECIES[0].internalId;

// 1. Edit the fixture through the real save-core and export.
const fixture = new Uint8Array(readFileSync(path.join(rootDir, "tests/fixtures/newgame.sav")));
const { bytes } = parseSave(fixture);
setMoney(bytes, EDIT_MONEY);
setPartyMon(bytes, 0, createMon(BULBASAUR, 7), { nickname: "SMOKE", otName: "RED" });
const edited = exportSave(bytes, fixture);

if (getMoney(edited) !== EDIT_MONEY) throw new Error("save-core did not write money");
if (getParty(edited).length !== 1) throw new Error("save-core did not add the party mon");

// 2. Boot the ROM with the edited save and continue into the overworld.
const gb = new Driver(romPath, edited);
console.log("Booting with edited save…");
gb.steps(240);
for (let i = 0; i < 120 && !gb.screenText().includes("CONTINUE"); i++) {
  gb.tap(KEYMAP.START, 20);
  if (gb.screenText().includes("CONTINUE")) break;
  gb.tap(KEYMAP.A, 20);
}
if (!gb.screenText().includes("CONTINUE")) {
  throw new Error(`Title screen has no CONTINUE option (save not recognized).\n${gb.screenText()}`);
}
console.log("CONTINUE offered — the game recognizes the save.");

gb.chooseMenuEntry("CONTINUE");
// The continue screen shows a stats box; tap A through it to the overworld.
gb.waitFor("overworld", () => gb.readByte(WRAM.curMap) === 0x26 && !gb.screenText().includes("┌"), {
  timeout: 6000,
  interval: 6,
  keys: [KEYMAP.A],
});

// 3. Assert the game's WRAM matches the edits.
const name = decodeGen1Text(gb.readBytes(WRAM.playerName, 11));
const partyCount = gb.readByte(WRAM.partyCount);
const m = gb.readBytes(WRAM.money, 3);
const wramMoney =
  (m[0] >> 4) * 100000 + (m[0] & 15) * 10000 + (m[1] >> 4) * 1000 + (m[1] & 15) * 100 + (m[2] >> 4) * 10 + (m[2] & 15);

console.log(`WRAM after continue: name=${name} party=${partyCount} money=${wramMoney}`);

const failures: string[] = [];
if (name !== "RED") failures.push(`player name is ${name}, expected RED`);
if (partyCount !== 1) failures.push(`party count is ${partyCount}, expected 1`);
if (wramMoney !== EDIT_MONEY) failures.push(`money is ${wramMoney}, expected ${EDIT_MONEY}`);
if (gb.readByte(WRAM.partySpecies) !== BULBASAUR)
  failures.push(`first party species is ${gb.readByte(WRAM.partySpecies)}, expected ${BULBASAUR}`);

if (failures.length) {
  console.error("SMOKE FAILED:\n - " + failures.join("\n - "));
  process.exit(1);
}
console.log(
  `SMOKE PASSED: the game loaded the edited save (${speciesByInternalId(BULBASAUR)?.name} in party, ¥${EDIT_MONEY}).`,
);
