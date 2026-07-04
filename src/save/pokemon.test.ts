import { describe, expect, it } from "vitest";
import { PARTY_MON_SIZE } from "./layout";
import { getDvs, makePpByte, maxPp, packDvs, ppCurrent, ppUps, readMon, writeMon, type MonRecord } from "./pokemon";

/** Build a synthetic 44-byte party record for a Pikachu-like mon. */
function sampleBytes(): Uint8Array {
  const b = new Uint8Array(PARTY_MON_SIZE);
  b.set(
    [
      0x54, // species: PIKACHU internal id
      0x00, 0x13, // current HP 19
      0x05, // box level 5
      0x00, // status
      0x17, 0x17, // types electric/electric
      0xa3, // catch rate
      0x54, 0x27, 0x00, 0x00, // moves: growl(0x2d=45)? use raw ids 84, 39
      0x12, 0x34, // OT id 0x1234
      0x00, 0x00, 0x87, // exp 135
      0x00, 0x01, // hp stat exp 1
      0x00, 0x02, 0x00, 0x03, 0x00, 0x04, 0x00, 0x05, // atk/def/spd/spc stat exp
      0xab, 0xcd, // DVs: atk 10, def 11, spd 12, spc 13
      0x28, 0x19, 0x00, 0x00, // PP
      0x05, // level (party only)
      0x00, 0x13, // max HP 19
      0x00, 0x0a, 0x00, 0x0b, 0x00, 0x0c, 0x00, 0x0d, // stats
    ],
    0,
  );
  return b;
}

describe("readMon", () => {
  it("decodes every field of a party record", () => {
    const mon = readMon(sampleBytes(), 0, true);
    expect(mon.species).toBe(0x54);
    expect(mon.currentHp).toBe(19);
    expect(mon.boxLevel).toBe(5);
    expect(mon.status).toBe(0);
    expect(mon.types).toEqual([0x17, 0x17]);
    expect(mon.catchRate).toBe(0xa3);
    expect(mon.moves).toEqual([0x54, 0x27, 0, 0]);
    expect(mon.otId).toBe(0x1234);
    expect(mon.exp).toBe(135);
    expect(mon.statExp).toEqual({ hp: 1, atk: 2, def: 3, spd: 4, spc: 5 });
    expect(mon.dvs).toEqual({ atk: 0xa, def: 0xb, spd: 0xc, spc: 0xd });
    expect(mon.pp).toEqual([0x28, 0x19, 0, 0]);
    expect(mon.level).toBe(5);
    expect(mon.maxHp).toBe(19);
    expect(mon.stats).toEqual({ atk: 10, def: 11, spd: 12, spc: 13 });
  });

  it("reads box records without the party-only tail", () => {
    const mon = readMon(sampleBytes(), 0, false);
    expect(mon.level).toBe(5); // falls back to box level
    expect(mon.stats).toBeUndefined();
  });
});

describe("writeMon", () => {
  it("round-trips a record byte-for-byte", () => {
    const original = sampleBytes();
    const mon = readMon(original, 0, true);
    const out = new Uint8Array(PARTY_MON_SIZE);
    writeMon(out, 0, mon, true);
    expect(Array.from(out)).toEqual(Array.from(original));
  });
});

describe("DV packing", () => {
  it("extracts the HP DV from the LSBs of the other four", () => {
    // atk 0xa (lsb 0), def 0xb (1), spd 0xc (0), spc 0xd (1) -> 0b0101 = 5
    expect(getDvs(0xab, 0xcd).hp).toBe(5);
  });
  it("packs nibbles back into two bytes", () => {
    expect(packDvs({ atk: 0xa, def: 0xb, spd: 0xc, spc: 0xd })).toEqual([0xab, 0xcd]);
  });
});

describe("PP byte encoding", () => {
  it("splits the PP byte into current PP (bits 0-5) and PP Ups (bits 6-7)", () => {
    // 30 current PP + 3 PP Ups: 30 | (3<<6) = 30 + 192 = 222
    const byte = 222;
    expect(ppCurrent(byte)).toBe(30);
    expect(ppUps(byte)).toBe(3);
  });

  it("round-trips through makePpByte", () => {
    for (const cur of [0, 15, 40, 61, 63]) {
      for (const ups of [0, 1, 2, 3]) {
        const byte = makePpByte(cur, ups);
        expect(ppCurrent(byte)).toBe(cur);
        expect(ppUps(byte)).toBe(ups);
      }
    }
  });

  it("clamps current PP to 6 bits and PP Ups to 2 bits", () => {
    expect(ppCurrent(makePpByte(99, 9))).toBe(63);
    expect(ppUps(makePpByte(99, 9))).toBe(3);
  });
});

describe("maxPp", () => {
  it("adds floor(basePP/5) per PP Up, capped at 7 per PP Up", () => {
    // Thunderbolt base 15: +3 per PP Up -> 24 at 3 PP Ups
    expect(maxPp(15, 0)).toBe(15);
    expect(maxPp(15, 3)).toBe(24);
    // base 40: floor(40/5)=8 -> capped at 7 per PP Up
    expect(maxPp(40, 1)).toBe(47);
    expect(maxPp(40, 3)).toBe(61);
    // base 5: +1 per PP Up
    expect(maxPp(5, 3)).toBe(8);
  });
});

describe("MonRecord type", () => {
  it("keeps box-only records assignable without party fields", () => {
    const mon: MonRecord = readMon(sampleBytes(), 0, false);
    expect(mon.species).toBe(0x54);
  });
});
