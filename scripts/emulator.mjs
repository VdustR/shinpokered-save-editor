/**
 * Minimal headless Shin Pokémon Red driver on top of serverboy, shared by the
 * fixture generator and the emulator smoke test.
 *
 * State detection reads the game's own memory instead of guessing frame
 * counts: the on-screen text lives in wTileMap (0xc3a0, 20x18 tiles) and text
 * tiles are the Gen 1 character codes, so the tilemap can be decoded with the
 * generated charmap. Cursor rows are marked with the $ed arrow tile.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const GameBoy = require("serverboy");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gamedata = JSON.parse(readFileSync(path.join(rootDir, "src/gen/gamedata.json"), "utf8"));

export const KEYMAP = GameBoy.KEYMAP;

const TILEMAP = 0xc3a0;
const COLS = 20;
const ROWS = 18;

export const WRAM = {
  playerName: 0xd158,
  partyCount: 0xd163,
  partySpecies: 0xd164,
  money: 0xd347,
  curMap: 0xd35e,
  obtainedBadges: 0xd356,
};

export class Driver {
  constructor(romPath, saveData) {
    this.gb = new GameBoy();
    const rom = readFileSync(romPath);
    if (saveData) this.gb.loadRom(rom, Array.from(saveData));
    else this.gb.loadRom(rom);
    this.frame = 0;
    // The ROM is GBC-enhanced, so the core banks 0xd000-0xdfff into
    // GBCMemory instead of the flat memory array that getMemory() returns.
    // Reach through serverboy's private state key to use the real memory
    // readers for accurate WRAM reads.
    const privateKey = Object.keys(this.gb)[0];
    this.core = this.gb[privateKey].gameboy;
    if (!this.core?.memoryReader) throw new Error("Could not access serverboy core internals");
  }

  readByte(address) {
    return this.core.memoryReader[address](this.core, address);
  }

  readBytes(address, length) {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) out[i] = this.readByte(address + i);
    return out;
  }

  steps(frames, keys = []) {
    for (let i = 0; i < frames; i++) {
      if (keys.length > 0) this.gb.pressKeys(keys);
      this.gb.doFrame();
      this.frame += 1;
    }
  }

  /** Press and release: hold 2 frames, release `gap` frames. */
  tap(key, gap = 8) {
    this.steps(2, [key]);
    this.steps(gap);
  }

  memory() {
    return this.gb.getMemory();
  }

  saveData() {
    return Uint8Array.from(this.gb.getSaveData());
  }

  screenRows() {
    const mem = this.readBytes(TILEMAP, COLS * ROWS);
    const rows = [];
    for (let y = 0; y < ROWS; y++) {
      let row = "";
      for (let x = 0; x < COLS; x++) {
        const tile = mem[y * COLS + x];
        if (tile === 0xed) {
          row += ">";
          continue;
        }
        const token = gamedata.charmap[tile];
        row += token && token.length === 1 ? token : " ";
      }
      rows.push(row);
    }
    return rows;
  }

  screenText() {
    return this.screenRows().join("\n");
  }

  /**
   * Advance frames (optionally holding keys) until `predicate()` is true.
   * Checks every `interval` frames; throws after `timeout` frames.
   */
  waitFor(label, predicate, { keys = [], interval = 4, timeout = 4000 } = {}) {
    const start = this.frame;
    while (this.frame - start < timeout) {
      if (predicate()) return;
      this.steps(interval, keys);
    }
    throw new Error(`Timed out waiting for ${label} after ${timeout} frames.\nScreen:\n${this.screenText()}`);
  }

  waitForText(text, options = {}) {
    this.waitFor(`text ${JSON.stringify(text)}`, () => this.screenText().includes(text), options);
  }

  /** Mash A until `text` appears (dialogue advancing). */
  mashAUntilText(text, { timeout = 6000 } = {}) {
    this.waitFor(`text ${JSON.stringify(text)} (mashing A)`, () => this.screenText().includes(text), {
      timeout,
      interval: 2,
      keys: [],
    });
  }

  /** Advance dialogue by tapping A between checks until text appears. */
  advanceDialogUntil(predicate, { timeout = 8000, label = "dialog state" } = {}) {
    const start = this.frame;
    while (this.frame - start < timeout) {
      if (predicate()) return;
      this.tap(KEYMAP.A, 6);
    }
    throw new Error(`Timed out advancing dialog to ${label}.\nScreen:\n${this.screenText()}`);
  }

  /** Move the menu cursor (">") to the row containing `entry`, then press A. */
  chooseMenuEntry(entry, { timeout = 600 } = {}) {
    const rowOf = () => this.screenRows().findIndex((row) => row.includes(entry));
    const cursorRow = () => this.screenRows().findIndex((row) => row.includes(">"));
    this.waitFor(`menu entry ${entry}`, () => rowOf() >= 0 && cursorRow() >= 0, { timeout });
    let guard = 0;
    while (cursorRow() !== rowOf()) {
      this.tap(cursorRow() < rowOf() ? KEYMAP.DOWN : KEYMAP.UP, 6);
      if (++guard > 30) {
        throw new Error(`Could not reach menu entry ${entry}.\nScreen:\n${this.screenText()}`);
      }
    }
    this.tap(KEYMAP.A, 8);
  }
}

export function decodeGen1Text(bytes) {
  let out = "";
  for (const byte of bytes) {
    if (byte === 0x50) break;
    const token = gamedata.charmap[byte];
    out += token ?? "?";
  }
  return out;
}
