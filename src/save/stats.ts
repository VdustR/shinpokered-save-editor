/**
 * Gen 1 stat and experience formulas, ported from shinpokered
 * `engine/multiply_divide.asm` (_CalcStat) and `engine/experience.asm`
 * (CalcExperience + GrowthRateTable).
 */

/**
 * Stat-exp bonus: smallest b >= 1 with b^2 >= statExp, capped at 255,
 * then integer-divided by 4 (the game shifts right twice).
 */
export function statExpBonus(statExp: number): number {
  let b = Math.ceil(Math.sqrt(Math.max(statExp, 0)));
  if (b < 1) b = 1;
  if (b > 255) b = 255;
  return b >> 2;
}

export interface CalcStatInput {
  base: number;
  dv: number;
  statExp: number;
  level: number;
  isHp: boolean;
}

export function calcStat({ base, dv, statExp, level, isHp }: CalcStatInput): number {
  const core = Math.floor((((base + dv) * 2 + statExpBonus(statExp)) * level) / 100);
  const value = isHp ? core + level + 10 : core + 5;
  return Math.min(value, 999);
}

/**
 * GrowthRateTable rows: coefficient encoding from the game data.
 * exp(n) = floor(cubeNum * n^3 / cubeDen) + quad*n^2 + linear*n - constant
 */
const GROWTH_RATES: Record<
  number,
  { cubeNum: number; cubeDen: number; quad: number; linear: number; constant: number }
> = {
  0: { cubeNum: 1, cubeDen: 1, quad: 0, linear: 0, constant: 0 }, // medium fast
  1: { cubeNum: 3, cubeDen: 4, quad: 10, linear: 0, constant: 30 }, // unused
  2: { cubeNum: 3, cubeDen: 4, quad: 20, linear: 0, constant: 70 }, // unused
  3: { cubeNum: 6, cubeDen: 5, quad: -15, linear: 100, constant: 140 }, // medium slow
  4: { cubeNum: 4, cubeDen: 5, quad: 0, linear: 0, constant: 0 }, // fast
  5: { cubeNum: 5, cubeDen: 4, quad: 0, linear: 0, constant: 0 }, // slow
};

export const GROWTH_RATE_NAMES: Record<number, string> = {
  0: "Medium Fast",
  1: "3/4 cubic (unused)",
  2: "3/4 cubic (unused)",
  3: "Medium Slow",
  4: "Fast",
  5: "Slow",
};

export function expForLevel(growthRate: number, level: number): number {
  const rate = GROWTH_RATES[growthRate] ?? GROWTH_RATES[0];
  const n = level;
  const value =
    Math.floor((rate.cubeNum * n ** 3) / rate.cubeDen) + rate.quad * n ** 2 + rate.linear * n - rate.constant;
  return Math.max(value, 0);
}

export function levelForExp(growthRate: number, exp: number): number {
  let level = 1;
  for (let n = 100; n >= 1; n--) {
    if (expForLevel(growthRate, n) <= exp) {
      level = n;
      break;
    }
  }
  return level;
}
