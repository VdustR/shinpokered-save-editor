import { describe, expect, it } from "vitest";
import { exportPk1, importPk1, PK1_SIZE } from "./pk1";
import { recalcDerivedFields } from "./derive";
import type { MonRecord } from "./pokemon";

const BULBASAUR = 153;

function mkMon(): MonRecord {
  const mon: MonRecord = {
    species: BULBASAUR,
    currentHp: 20,
    boxLevel: 13,
    status: 0,
    types: [22, 3],
    catchRate: 45,
    moves: [33, 45, 73, 0],
    otId: 54321,
    exp: 1000,
    statExp: { hp: 11, atk: 22, def: 33, spd: 44, spc: 55 },
    dvs: { atk: 15, def: 10, spd: 10, spc: 10 },
    pp: [35, 40, 10, 0],
    level: 13,
  };
  recalcDerivedFields(mon);
  return mon;
}

describe("pk1 round-trip", () => {
  it("exports the PKHeX 69-byte single-list layout", () => {
    const bytes = exportPk1(mkMon(), { nickname: "LEAFY", otName: "VIPRO" });
    expect(bytes).toHaveLength(PK1_SIZE);
    expect(bytes[0]).toBe(1); // count
    expect(bytes[1]).toBe(BULBASAUR); // species mark
    expect(bytes[2]).toBe(0xff); // list terminator
    expect(bytes[3]).toBe(BULBASAUR); // record species
    expect(bytes[47]).not.toBe(0x50); // OT name present
    expect(bytes[58]).not.toBe(0x50); // nickname present
  });

  it("round-trips a mon and its names losslessly", () => {
    const mon = mkMon();
    const names = { nickname: "LEAFY", otName: "VIPRO" };
    const back = importPk1(exportPk1(mon, names));
    expect(back.mon).toEqual(mon);
    expect(back.names).toEqual(names);
  });

  it("accepts a raw 44-byte party record with fallback names", () => {
    const full = exportPk1(mkMon(), { nickname: "LEAFY", otName: "VIPRO" });
    const raw = full.subarray(3, 3 + 44);
    const back = importPk1(raw);
    expect(back.mon.species).toBe(BULBASAUR);
    expect(back.names.nickname).toBe("");
  });

  it("rejects Japanese lists, empty slots, and unknown sizes", () => {
    expect(() => importPk1(new Uint8Array(59))).toThrow(/Japanese/);
    const empty = exportPk1(mkMon(), { nickname: "A", otName: "B" });
    empty[1] = 0xff;
    expect(() => importPk1(empty)).toThrow(/empty|match/);
    expect(() => importPk1(new Uint8Array(50))).toThrow(/Unrecognized/);
  });

  it("rejects a header/record species mismatch", () => {
    const bytes = exportPk1(mkMon(), { nickname: "A", otName: "B" });
    bytes[1] = 1; // claim RHYDON in the header
    expect(() => importPk1(bytes)).toThrow(/does not match/);
  });
});
