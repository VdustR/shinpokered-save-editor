import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BinjgbCore,
  CPU_TICKS_PER_SECOND,
  EVENT_NEW_FRAME,
  loadBinjgb,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from "./core";

/**
 * Synthetic 32 KiB cartridge with a valid header checksum. `0x13`/`0x03` is
 * MBC3+RAM+BATTERY with 32 KiB ext RAM — the shinpokered / Pokémon Red
 * cartridge type — so the ext-RAM round-trip matches a real .sav in size.
 */
function makeRom(cartType = 0x13, ramSize = 0x03): Uint8Array {
  const rom = new Uint8Array(0x8000);
  // Entry point: spin in place (jr -2) so the LCD keeps producing frames
  // instead of the CPU wandering off into zero-filled memory.
  rom[0x100] = 0x18;
  rom[0x101] = 0xfe;
  rom[0x147] = cartType;
  rom[0x149] = ramSize;
  let checksum = 0;
  for (let i = 0x134; i <= 0x14c; i++) checksum = (checksum - rom[i] - 1) & 0xff;
  rom[0x14d] = checksum;
  return rom;
}

beforeAll(async () => {
  // Node has no fetch-able asset URL; hand the wasm bytes over directly.
  const wasmBinary = await readFile(new URL("./binjgb.wasm", import.meta.url));
  await loadBinjgb({ wasmBinary });
});

describe("BinjgbCore", () => {
  it("boots an MBC3+RAM+BATTERY cartridge and renders frames", async () => {
    const core = await BinjgbCore.create(makeRom(), { sampleRate: 44100 });
    try {
      expect(core.frameBuffer()).toHaveLength(SCREEN_WIDTH * SCREEN_HEIGHT * 4);

      // Warm up through the boot sequence (LCD is briefly off), then the
      // second emulated second must produce a steady ~59.7 fps.
      core.runUntil(core.ticks + CPU_TICKS_PER_SECOND);
      let frames = 0;
      core.runUntil(core.ticks + CPU_TICKS_PER_SECOND, (event) => {
        if (event & EVENT_NEW_FRAME) frames++;
      });
      expect(frames).toBeGreaterThanOrEqual(59);
      expect(frames).toBeLessThanOrEqual(61);
    } finally {
      core.delete();
    }
  });

  it("round-trips 32 KiB battery RAM and flags updates", async () => {
    const core = await BinjgbCore.create(makeRom(), { sampleRate: 44100 });
    try {
      const sram = new Uint8Array(0x8000);
      for (let i = 0; i < sram.length; i++) sram[i] = (i * 31 + 7) & 0xff;

      expect(core.readExtRam()).toHaveLength(0x8000);
      expect(core.loadExtRam(sram)).toBe(true);
      expect(core.readExtRam()).toEqual(sram);

      // Wrong size is rejected without touching the emulator.
      expect(core.loadExtRam(new Uint8Array(123))).toBe(false);
      expect(core.readExtRam()).toEqual(sram);

      // The zero-filled test ROM never writes to ext RAM.
      core.takeExtRamUpdated();
      core.runUntil(core.ticks + CPU_TICKS_PER_SECOND / 10);
      expect(core.takeExtRamUpdated()).toBe(false);

      // A non-finite target would spin the run loop forever; it must throw.
      expect(() => core.runUntil(Number.NaN)).toThrow(/non-finite/);
    } finally {
      core.delete();
    }
  });

  it("accepts joypad input and rejects a garbage ROM", async () => {
    const core = await BinjgbCore.create(makeRom(), { sampleRate: 44100 });
    try {
      for (const b of ["up", "down", "left", "right", "a", "b", "start", "select"] as const) {
        core.setButton(b, true);
        core.setButton(b, false);
      }
      core.runUntil(core.ticks + CPU_TICKS_PER_SECOND / 60);
    } finally {
      core.delete();
    }

    // An empty buffer cannot be a cartridge → binjgb refuses it.
    await expect(BinjgbCore.create(new Uint8Array(0), { sampleRate: 44100 })).rejects.toThrow(
      /rejected the ROM/,
    );
  });
});
