import { describe, expect, it } from "vitest";
import { TYPE_NAMES } from "./gamedata";
import type { MonRecord } from "./pokemon";
import { defenseProfile, effectiveness, offenseCoverage } from "./typechart";

function typeId(name: string): number {
  const hit = Object.entries(TYPE_NAMES).find(([, n]) => n === name);
  if (!hit) throw new Error(`unknown type ${name}`);
  return Number(hit[0]);
}

const WATER = typeId("WATER");
const FIRE = typeId("FIRE");
const GRASS = typeId("GRASS");
const GROUND = typeId("GROUND");
const FLYING = typeId("FLYING");
const ELECTRIC = typeId("ELECTRIC");
const GHOST = typeId("GHOST");
const PSYCHIC = typeId("PSYCHIC");
const NORMAL = typeId("NORMAL");

describe("effectiveness", () => {
  it("reads the chart for single types", () => {
    expect(effectiveness(WATER, [FIRE, FIRE])).toBe(2);
    expect(effectiveness(FIRE, [WATER, WATER])).toBe(0.5);
    expect(effectiveness(GROUND, [FLYING, FLYING])).toBe(0);
    expect(effectiveness(NORMAL, [NORMAL, NORMAL])).toBe(1);
  });

  it("multiplies both types of a dual-type defender", () => {
    // Electric vs Water/Flying (Gyarados): 2 x 2 = 4.
    expect(effectiveness(ELECTRIC, [WATER, FLYING])).toBe(4);
    // Grass vs Water/Flying: 2 x 0.5 = 1.
    expect(effectiveness(GRASS, [WATER, FLYING])).toBe(1);
  });

  it("includes Shin's Ghost-vs-Psychic fix", () => {
    expect(effectiveness(GHOST, [PSYCHIC, PSYCHIC])).toBe(2);
  });
});

function monWithMoves(moves: [number, number, number, number]): MonRecord {
  return {
    species: 153,
    currentHp: 1,
    boxLevel: 5,
    status: 0,
    types: [22, 3],
    catchRate: 45,
    moves,
    otId: 0,
    exp: 0,
    statExp: { hp: 0, atk: 0, def: 0, spd: 0, spc: 0 },
    dvs: { atk: 0, def: 0, spd: 0, spc: 0 },
    pp: [0, 0, 0, 0],
    level: 5,
  };
}

describe("offenseCoverage", () => {
  it("takes the best multiplier across damaging moves and ignores status moves", () => {
    // EMBER (52, Fire) + GROWL (45, status, power 0).
    const cov = offenseCoverage([monWithMoves([52, 45, 0, 0])]);
    expect(cov.get(GRASS)).toBe(2);
    expect(cov.get(WATER)).toBe(0.5);
    expect(cov.get(NORMAL)).toBe(1);
  });

  it("flags uncovered types as 0 when a chart immunity applies", () => {
    // EARTHQUAKE (89, Ground) vs Flying = 0.
    const cov = offenseCoverage([monWithMoves([89, 0, 0, 0])]);
    expect(cov.get(FLYING)).toBe(0);
  });
});

describe("defenseProfile", () => {
  it("classifies weaknesses, resists, and immunities for a dual type", () => {
    const p = defenseProfile([WATER, FLYING]); // Gyarados-ish
    expect(p.weak).toContain(ELECTRIC);
    expect(p.resist).toContain(FIRE);
    expect(p.immune).toContain(GROUND);
  });
});
