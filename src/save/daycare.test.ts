import { describe, expect, it } from "vitest";
import { NAME_LENGTH, OFFSETS, SAVE_SIZE } from "./layout";
import type { MonRecord } from "./pokemon";
import { clearDayCare, getDayCare, setDayCareMon } from "./savefile";
import { encodeText } from "./text";

function mon(species: number, level: number): MonRecord {
  return {
    species,
    currentHp: 20,
    boxLevel: level,
    status: 0,
    types: [0, 0],
    catchRate: 45,
    moves: [33, 0, 0, 0],
    otId: 0x1234,
    exp: 1000,
    statExp: { hp: 0, atk: 0, def: 0, spd: 0, spc: 0 },
    dvs: { atk: 5, def: 6, spd: 7, spc: 8 },
    pp: [35, 0, 0, 0],
    level,
  };
}

describe("day care", () => {
  it("writes a boarded mon (in-use byte, box record, names) and reads it back", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    setDayCareMon(bytes, mon(0x54, 20), { nickname: "SPARKY", otName: "VIOLET" });

    expect(bytes[OFFSETS.dayCareInUse]).toBe(1);
    const dc = getDayCare(bytes);
    expect(dc.inUse).toBe(true);
    expect(dc.mon?.mon.species).toBe(0x54);
    expect(dc.mon?.mon.level).toBe(20); // box record: level lives in boxLevel byte
    expect(dc.mon?.nickname).toBe("SPARKY");
    expect(dc.mon?.otName).toBe("VIOLET");
    // Names land at the game's regions.
    expect(Array.from(bytes.slice(OFFSETS.dayCareMonName, OFFSETS.dayCareMonName + 7))).toEqual(
      Array.from(encodeText("SPARKY", 7)),
    );
  });

  it("clearDayCare resets the in-use byte and wipes the record and names", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    setDayCareMon(bytes, mon(0x54, 20), { nickname: "SPARKY", otName: "VIOLET" });
    clearDayCare(bytes);
    expect(getDayCare(bytes).inUse).toBe(false);
    expect(bytes[OFFSETS.dayCareMon]).toBe(0); // species byte wiped
    expect(bytes[OFFSETS.dayCareMonName]).toBe(0);
    expect(bytes[OFFSETS.dayCareMonOt + NAME_LENGTH - 1]).toBe(0);
  });
});
