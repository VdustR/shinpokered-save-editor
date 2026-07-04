import { describe, expect, it } from "vitest";
import { autoSortItems, moveInArray } from "./reorder";
import { ITEMS } from "./gamedata";
import { BOX_DATA_SIZE, MONS_PER_BOX, NAME_LENGTH, OFFSETS, SAVE_SIZE, storedBoxOffset } from "./layout";
import type { MonRecord } from "./pokemon";
import { getParty, readBox, reorderBoxMon, reorderParty, setPartyMon, writeBoxMon } from "./savefile";
import { encodeText } from "./text";

describe("moveInArray", () => {
  it("moves an element from one index to another, shifting the rest", () => {
    expect(moveInArray(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveInArray(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(moveInArray(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input", () => {
    const src = [1, 2, 3];
    moveInArray(src, 0, 2);
    expect(src).toEqual([1, 2, 3]);
  });
});

describe("autoSortItems", () => {
  const itemId = (name: string) => ITEMS.find((i) => i.name === name)!.id;

  it("orders items by the game's ItemSortList (balls before potions before TMs)", () => {
    const input = [
      { id: itemId("TM01 MEGA PUNCH"), count: 1 },
      { id: itemId("POTION"), count: 5 },
      { id: itemId("POKé BALL"), count: 10 },
    ];
    const sorted = autoSortItems(input).map((s) => s.id);
    expect(sorted).toEqual([itemId("POKé BALL"), itemId("POTION"), itemId("TM01 MEGA PUNCH")]);
  });

  it("keeps quantities and is stable for unlisted items", () => {
    const input = [
      { id: itemId("POTION"), count: 3 },
      { id: itemId("POKé BALL"), count: 7 },
    ];
    const sorted = autoSortItems(input);
    expect(sorted.find((s) => s.id === itemId("POTION"))!.count).toBe(3);
    expect(sorted[0].id).toBe(itemId("POKé BALL"));
  });
});

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
    maxHp: 10,
    stats: { atk: 9, def: 9, spd: 9, spc: 9 },
  };
}

function emptySave(): Uint8Array {
  const bytes = new Uint8Array(SAVE_SIZE);
  bytes[OFFSETS.partySpecies] = 0xff;
  bytes[OFFSETS.currentBox + 1] = 0xff;
  for (let i = 0; i < 12; i++) bytes[storedBoxOffset(i) + 1] = 0xff;
  bytes.set(encodeText("RED", NAME_LENGTH), OFFSETS.playerName);
  return bytes;
}

describe("reorderParty", () => {
  it("reorders party records, species list, and names together", () => {
    const bytes = emptySave();
    setPartyMon(bytes, 0, mon(0x99, 5), { nickname: "AAA", otName: "RED" });
    setPartyMon(bytes, 1, mon(0x54, 10), { nickname: "BBB", otName: "RED" });
    setPartyMon(bytes, 2, mon(0xb0, 15), { nickname: "CCC", otName: "RED" });

    reorderParty(bytes, 0, 2); // move slot 0 to the end

    const party = getParty(bytes);
    expect(party.map((s) => s.mon.species)).toEqual([0x54, 0xb0, 0x99]);
    expect(party.map((s) => s.nickname)).toEqual(["BBB", "CCC", "AAA"]);
    expect(party.map((s) => s.mon.level)).toEqual([10, 15, 5]);
    // Species list byte array stays in sync.
    expect(bytes[OFFSETS.partySpecies]).toBe(0x54);
    expect(bytes[OFFSETS.partySpecies + 2]).toBe(0x99);
    expect(bytes[OFFSETS.partySpecies + 3]).toBe(0xff);
  });
});

describe("uninitialized boxes (never written by the game)", () => {
  it("reads an all-0xff stored box as empty and uninitialized", () => {
    const bytes = emptySave();
    bytes[OFFSETS.currentBoxNum] = 0; // box 1 is current; box 2 is stored-only
    bytes.fill(0xff, storedBoxOffset(1), storedBoxOffset(1) + 100);
    const box = readBox(bytes, 1);
    expect(box.initialized).toBe(false);
    expect(box.mons).toHaveLength(0);
  });

  it("initializes an all-0xff box on first write instead of keeping garbage", () => {
    const bytes = emptySave();
    bytes[OFFSETS.currentBoxNum] = 0;
    const base = storedBoxOffset(1);
    bytes.fill(0xff, base, base + BOX_DATA_SIZE);

    writeBoxMon(bytes, 1, 0, mon(0x99, 5), { nickname: "AAA", otName: "RED" });

    const box = readBox(bytes, 1);
    expect(box.initialized).toBe(true);
    expect(box.mons).toHaveLength(1);
    expect(box.mons[0].mon.species).toBe(0x99);
    expect(bytes[base]).toBe(1); // count
    expect(bytes[base + 2]).toBe(0xff); // species terminator after the one entry
    // The garbage after the species terminator is cleared, not left as 0xff.
    expect(bytes[base + 1 + MONS_PER_BOX]).toBe(0);
  });
});

describe("current box with an uninitialized stored mirror", () => {
  it("seeds the mirror from the cache so higher slots stay writable", () => {
    const bytes = emptySave(); // current box = 0; cache at OFFSETS.currentBox
    // Two mons in the cache, stored slot left as raw 0xff fill.
    writeBoxMon(bytes, 0, 0, mon(0x99, 5), { nickname: "AAA", otName: "RED" });
    writeBoxMon(bytes, 0, 1, mon(0x54, 10), { nickname: "BBB", otName: "RED" });
    const stored = storedBoxOffset(0);
    bytes.fill(0xff, stored, stored + BOX_DATA_SIZE);

    // Appending at slot 2 must not throw against the wiped mirror.
    writeBoxMon(bytes, 0, 2, mon(0xb0, 15), { nickname: "CCC", otName: "RED" });

    const box = readBox(bytes, 0);
    expect(box.mons.map((m) => m.mon.species)).toEqual([0x99, 0x54, 0xb0]);
    // The stored mirror now equals the cache block.
    const cache = bytes.slice(OFFSETS.currentBox, OFFSETS.currentBox + BOX_DATA_SIZE);
    expect(Array.from(bytes.slice(stored, stored + BOX_DATA_SIZE))).toEqual(Array.from(cache));
  });
});

describe("reorderBoxMon", () => {
  it("reorders a box's records and names", () => {
    const bytes = emptySave(); // current box = 0
    writeBoxMon(bytes, 0, 0, mon(0x99, 5), { nickname: "AAA", otName: "RED" });
    writeBoxMon(bytes, 0, 1, mon(0x54, 10), { nickname: "BBB", otName: "RED" });

    reorderBoxMon(bytes, 0, 1, 0); // move slot 1 to front

    const box = readBox(bytes, 0);
    expect(box.mons.map((m) => m.mon.species)).toEqual([0x54, 0x99]);
    expect(box.mons.map((m) => m.nickname)).toEqual(["BBB", "AAA"]);
    // Current box is mirrored to storage.
    expect(bytes[storedBoxOffset(0) + 1]).toBe(0x54);
  });

  it("overwrites a stale stored mirror with the reordered cache (current box)", () => {
    const bytes = emptySave(); // current box = 0
    writeBoxMon(bytes, 0, 0, mon(0x99, 5), { nickname: "AAA", otName: "RED" });
    writeBoxMon(bytes, 0, 1, mon(0x54, 10), { nickname: "BBB", otName: "RED" });
    // Simulate a stale stored slot, as after an in-game save that only wrote
    // the cache: wipe the stored copy entirely.
    bytes.fill(0, storedBoxOffset(0), storedBoxOffset(0) + 100);
    bytes[storedBoxOffset(0) + 1] = 0xff;

    reorderBoxMon(bytes, 0, 1, 0);

    // The stored slot must equal the reordered cache, not a reorder of the
    // stale data.
    const stored = storedBoxOffset(0);
    expect(bytes[stored]).toBe(2); // count
    expect(bytes[stored + 1]).toBe(0x54);
    expect(bytes[stored + 2]).toBe(0x99);
    const cache = bytes.slice(OFFSETS.currentBox, OFFSETS.currentBox + 100);
    expect(Array.from(bytes.slice(stored, stored + 100))).toEqual(Array.from(cache));
  });
});
