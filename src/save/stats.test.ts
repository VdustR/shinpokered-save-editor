import { describe, expect, it } from "vitest";
import { calcStat, expForLevel, levelForExp, statExpBonus } from "./stats";

describe("statExpBonus", () => {
  // _CalcStat: smallest b >= 1 with b*b >= statExp, capped at 255, then >> 2.
  it("is 0 for zero stat exp", () => {
    expect(statExpBonus(0)).toBe(0);
  });
  it("is floor(ceil(sqrt(se))/4) for mid values", () => {
    expect(statExpBonus(100)).toBe(2); // ceil(sqrt(100)) = 10 -> 2
    expect(statExpBonus(101)).toBe(2); // ceil = 11 -> 2
    expect(statExpBonus(2500)).toBe(12); // 50 -> 12
  });
  it("caps at 63 for max stat exp (b caps at 255 in the game loop)", () => {
    expect(statExpBonus(65535)).toBe(63);
    expect(statExpBonus(65025)).toBe(63); // 255^2
  });
});

describe("calcStat", () => {
  it("computes level-5 starter stats (Bulbasaur, DV 0, no stat exp)", () => {
    // HP: floor(45*2*5/100) + 5 + 10 = 19; Atk: floor(49*2*5/100) + 5 = 9
    expect(calcStat({ base: 45, dv: 0, statExp: 0, level: 5, isHp: true })).toBe(19);
    expect(calcStat({ base: 49, dv: 0, statExp: 0, level: 5, isHp: false })).toBe(9);
  });

  it("computes known max values (Mew HP 403 at L100, DV 15, max stat exp)", () => {
    expect(calcStat({ base: 100, dv: 15, statExp: 65535, level: 100, isHp: true })).toBe(403);
  });

  it("caps at 999 like the game code (reachable via corrupt levels)", () => {
    // base 255, DV 15, max stat exp, level 255: floor(603*255/100)+255+10 = 1802 -> 999
    expect(calcStat({ base: 255, dv: 15, statExp: 65535, level: 255, isHp: true })).toBe(999);
  });
});

describe("expForLevel", () => {
  it("medium fast is n^3", () => {
    expect(expForLevel(0, 10)).toBe(1000);
    expect(expForLevel(0, 100)).toBe(1_000_000);
  });
  it("medium slow matches the famous level-5 starter value", () => {
    expect(expForLevel(3, 5)).toBe(135);
    expect(expForLevel(3, 100)).toBe(1_059_860);
  });
  it("fast and slow use floored fractional cubes", () => {
    expect(expForLevel(4, 10)).toBe(800);
    expect(expForLevel(5, 10)).toBe(1250);
    expect(expForLevel(4, 100)).toBe(800_000);
    expect(expForLevel(5, 100)).toBe(1_250_000);
  });
  it("clamps negative medium-slow low levels to 0", () => {
    expect(expForLevel(3, 1)).toBe(0);
  });
});

describe("levelForExp", () => {
  it("finds the highest level whose threshold is within the exp", () => {
    expect(levelForExp(3, 135)).toBe(5);
    expect(levelForExp(3, 134)).toBe(4);
    expect(levelForExp(0, 999)).toBe(9);
    expect(levelForExp(0, 1000)).toBe(10);
  });
  it("clamps to 1..100", () => {
    expect(levelForExp(0, 0)).toBe(1);
    expect(levelForExp(0, 99_999_999)).toBe(100);
  });
});
