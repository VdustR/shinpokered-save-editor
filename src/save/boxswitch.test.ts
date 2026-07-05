import { describe, expect, it } from "vitest";
import { BOX_DATA_SIZE, NAME_LENGTH, OFFSETS, SAVE_SIZE, storedBoxOffset } from "./layout";
import type { MonRecord } from "./pokemon";
import { getCurrentBoxIndex, readBox, switchCurrentBox, writeBoxMon } from "./savefile";
import { encodeText } from "./text";

function mon(species: number, level: number): MonRecord {
  return {
    species,
    currentHp: 10,
    boxLevel: level,
    status: 0,
    types: [0, 0],
    catchRate: 45,
    moves: [1, 0, 0, 0],
    otId: 1,
    exp: 100,
    statExp: { hp: 0, atk: 0, def: 0, spd: 0, spc: 0 },
    dvs: { atk: 0, def: 0, spd: 0, spc: 0 },
    pp: [35, 0, 0, 0],
    level,
  };
}

function freshSave(): Uint8Array {
  const bytes = new Uint8Array(SAVE_SIZE);
  bytes[OFFSETS.partySpecies] = 0xff;
  bytes[OFFSETS.currentBox + 1] = 0xff;
  // Never-changed boxes: bit 7 clear, stored slots raw 0xff like real SRAM.
  bytes[OFFSETS.currentBoxNum] = 0;
  for (let i = 0; i < 12; i++) bytes.fill(0xff, storedBoxOffset(i), storedBoxOffset(i) + BOX_DATA_SIZE);
  bytes.set(encodeText("RED", NAME_LENGTH), OFFSETS.playerName);
  return bytes;
}

describe("switchCurrentBox", () => {
  it("mirrors ChangeBox: first switch initializes all stored boxes and sets bit 7", () => {
    const bytes = freshSave();
    writeBoxMon(bytes, 0, 0, mon(0x99, 5), { nickname: "AAA", otName: "RED" });

    switchCurrentBox(bytes, 4);

    expect(getCurrentBoxIndex(bytes)).toBe(4);
    expect(bytes[OFFSETS.currentBoxNum] & 0x80).toBe(0x80); // has-switched marker
    // The old cache landed in box 1's stored slot.
    expect(bytes[storedBoxOffset(0)]).toBe(1);
    expect(bytes[storedBoxOffset(0) + 1]).toBe(0x99);
    // The new current box reads as a proper empty box, not 0xff garbage.
    const box5 = readBox(bytes, 4);
    expect(box5.initialized).toBe(true);
    expect(box5.mons).toHaveLength(0);
    // Every other stored box got initialized too, like EmptyAllSRAMBoxes.
    expect(bytes[storedBoxOffset(7)]).toBe(0);
    expect(bytes[storedBoxOffset(7) + 1]).toBe(0xff);
  });

  it("round-trips contents across switches", () => {
    const bytes = freshSave();
    writeBoxMon(bytes, 0, 0, mon(0x99, 5), { nickname: "AAA", otName: "RED" });
    switchCurrentBox(bytes, 4);
    writeBoxMon(bytes, 4, 0, mon(0x54, 10), { nickname: "BBB", otName: "RED" });
    switchCurrentBox(bytes, 0);

    expect(getCurrentBoxIndex(bytes)).toBe(0);
    expect(readBox(bytes, 0).mons[0].mon.species).toBe(0x99); // back in the cache
    expect(readBox(bytes, 4).mons[0].mon.species).toBe(0x54); // persisted to storage
  });

  it("is a no-op when switching to the same box", () => {
    const bytes = freshSave();
    writeBoxMon(bytes, 0, 0, mon(0x99, 5), { nickname: "AAA", otName: "RED" });
    const before = Uint8Array.from(bytes);
    switchCurrentBox(bytes, 0);
    expect(Array.from(bytes)).toEqual(Array.from(before));
  });
});

describe("first switch with editor-written boxes", () => {
  it("preserves boxes the editor initialized before the first switch", () => {
    const bytes = freshSave();
    writeBoxMon(bytes, 0, 0, mon(0x99, 5), { nickname: "AAA", otName: "RED" });
    // Edit a non-current box while bit 7 is still clear.
    writeBoxMon(bytes, 6, 0, mon(0xb0, 15), { nickname: "CCC", otName: "RED" });

    switchCurrentBox(bytes, 4);

    // The edited box survived the first-switch initialization.
    expect(readBox(bytes, 6).mons[0].mon.species).toBe(0xb0);
    // Untouched raw slots still got initialized.
    expect(bytes[storedBoxOffset(7)]).toBe(0);
  });
});
