import { describe, expect, it } from "vitest";
import { NAME_LENGTH, OFFSETS, SAVE_SIZE, storedBoxOffset } from "./layout";
import type { MonRecord } from "./pokemon";
import { getParty, readBox, removeBoxMon, removePartyMon, setPartyMon, writeBoxMon } from "./savefile";
import { encodeText } from "./text";

function mon(species: number): MonRecord {
  return {
    species,
    currentHp: 10,
    boxLevel: 5,
    status: 0,
    types: [0, 0],
    catchRate: 45,
    moves: [33, 0, 0, 0],
    otId: 1,
    exp: 135,
    statExp: { hp: 0, atk: 0, def: 0, spd: 0, spc: 0 },
    dvs: { atk: 0, def: 0, spd: 0, spc: 0 },
    pp: [35, 0, 0, 0],
    level: 5,
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

describe("removePartyMon", () => {
  it("compacts records, names, and the species list", () => {
    const bytes = emptySave();
    setPartyMon(bytes, 0, mon(0x99), { nickname: "A", otName: "RED" });
    setPartyMon(bytes, 1, mon(0x54), { nickname: "B", otName: "RED" });
    setPartyMon(bytes, 2, mon(0xb0), { nickname: "C", otName: "RED" });
    removePartyMon(bytes, 1);
    const party = getParty(bytes);
    expect(party.map((slot) => slot.mon.species)).toEqual([0x99, 0xb0]);
    expect(party.map((slot) => slot.nickname)).toEqual(["A", "C"]);
    expect(bytes[OFFSETS.partyCount]).toBe(2);
    expect(bytes[OFFSETS.partySpecies + 2]).toBe(0xff);
  });

  it("rejects out-of-range slots", () => {
    const bytes = emptySave();
    setPartyMon(bytes, 0, mon(0x99), { nickname: "A", otName: "RED" });
    expect(() => removePartyMon(bytes, 1)).toThrow(RangeError);
  });
});

describe("removeBoxMon", () => {
  it("compacts a stored box and updates both copies for the current box", () => {
    const bytes = emptySave(); // current box = 0
    writeBoxMon(bytes, 0, 0, mon(0x99), { nickname: "A", otName: "RED" });
    writeBoxMon(bytes, 0, 1, mon(0x54), { nickname: "B", otName: "RED" });
    removeBoxMon(bytes, 0, 0);
    const box = readBox(bytes, 0);
    expect(box.mons.map((slot) => slot.mon.species)).toEqual([0x54]);
    expect(box.mons[0].nickname).toBe("B");
    // Stored copy stays in sync with the cache.
    expect(bytes[storedBoxOffset(0)]).toBe(1);
    expect(bytes[storedBoxOffset(0) + 1]).toBe(0x54);
  });
});
