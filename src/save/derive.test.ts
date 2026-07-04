import { describe, expect, it } from "vitest";
import { createMon, recalcDerivedFields } from "./derive";
import { speciesByInternalId } from "./gamedata";

describe("createMon", () => {
  it("creates a level-5 Bulbasaur with correct derived values", () => {
    // Bulbasaur internal id is 0x99; base stats 45/49/49/45/65, medium slow.
    const bulba = speciesByInternalId(0x99)!;
    expect(bulba.name).toBe("BULBASAUR");
    const mon = createMon(0x99, 5);
    expect(mon.species).toBe(0x99);
    expect(mon.level).toBe(5);
    expect(mon.boxLevel).toBe(5);
    expect(mon.exp).toBe(135); // medium slow level 5
    expect(mon.maxHp).toBe(19); // DV 0, no stat exp
    expect(mon.currentHp).toBe(19);
    expect(mon.stats?.atk).toBe(9);
    expect(mon.types).toEqual([22, 3]); // grass/poison
    expect(mon.moves.filter((m) => m !== 0).length).toBeGreaterThan(0);
    expect(mon.pp[0]).toBeGreaterThan(0);
  });
});

describe("recalcDerivedFields", () => {
  it("updates exp, stats, types, and heals to the new max HP", () => {
    const mon = createMon(0x99, 5);
    mon.level = 50;
    recalcDerivedFields(mon);
    expect(mon.boxLevel).toBe(50);
    expect(mon.exp).toBe(expForLevel50MediumSlow());
    // HP: floor((45*2)*50/100) + 50 + 10 = 105
    expect(mon.maxHp).toBe(105);
    expect(mon.currentHp).toBe(105);
    // Atk: floor((49*2)*50/100) + 5 = 54
    expect(mon.stats?.atk).toBe(54);
  });

  it("keeps exp when it is already within the level band", () => {
    const mon = createMon(0x99, 5);
    mon.exp = 140; // still level 5 for medium slow (L6 = 179)
    recalcDerivedFields(mon);
    expect(mon.exp).toBe(140);
    expect(mon.level).toBe(5);
  });

  it("respects DVs and stat exp in the recalculation", () => {
    const mon = createMon(0x99, 100);
    mon.dvs = { atk: 15, def: 15, spd: 15, spc: 15 };
    mon.statExp = { hp: 65535, atk: 65535, def: 65535, spd: 65535, spc: 65535 };
    recalcDerivedFields(mon);
    // HP DV of all-15 DVs is 15: floor(((45+15)*2+63)*100/100) + 100 + 10 = 293
    expect(mon.maxHp).toBe(293);
  });
});

function expForLevel50MediumSlow(): number {
  return Math.floor((6 * 50 ** 3) / 5) - 15 * 50 ** 2 + 100 * 50 - 140;
}
