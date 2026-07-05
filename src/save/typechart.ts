/**
 * Type-effectiveness helpers built on the generated type_effects.asm matrix
 * (Shin's chart, which includes the Ghost-vs-Psychic ×2 fix).
 */
import gamedata from "../gen/gamedata.json";
import { moveInfo } from "./gamedata";
import type { MonRecord } from "./pokemon";

interface TypeEffect {
  atk: number;
  def: number;
  mult: number;
}

const EFFECTS = gamedata.typeEffects as TypeEffect[];

const byPair = new Map<number, number>();
for (const e of EFFECTS) byPair.set((e.atk << 8) | e.def, e.mult);

/**
 * Playable type ids, sorted. TYPELESS is an internal marker type (used by
 * Struggle-style mechanics), never a species or chart type, so it is
 * excluded from coverage displays.
 */
export const CHART_TYPES: number[] = Object.entries(gamedata.typeNames as Record<number, string>)
  .filter(([, name]) => name !== "TYPELESS")
  .map(([id]) => Number(id))
  .sort((a, b) => a - b);

function single(atk: number, def: number): number {
  return byPair.get((atk << 8) | def) ?? 1;
}

/**
 * Multiplier for an attacking type against a defender's type pair.
 * A mono-type defender (both slots equal) only applies the matchup once.
 */
export function effectiveness(atkType: number, defTypes: [number, number]): number {
  const [a, b] = defTypes;
  return a === b ? single(atkType, a) : single(atkType, a) * single(atkType, b);
}

export interface OffenseCoverage {
  /** Best multiplier any damaging team move achieves against this type. */
  best: number;
}

/**
 * Offensive coverage: for each defending type, the best single-type
 * multiplier among the team's damaging moves (STAB and dual types of the
 * defender are out of scope — this is a mono-type coverage table).
 */
export function offenseCoverage(team: MonRecord[]): Map<number, number> {
  const attackTypes = new Set<number>();
  for (const mon of team) {
    for (const id of mon.moves) {
      const info = id ? moveInfo(id) : undefined;
      // Power 1 marks Gen 1 fixed-damage moves (Seismic Toss, Dragon Rage,
      // OHKO moves, Counter, Super Fang); they ignore the type chart, so
      // they contribute no coverage. Real attacks all have power >= 10.
      if (info && info.power > 1) attackTypes.add(info.type);
    }
  }
  const out = new Map<number, number>();
  for (const def of CHART_TYPES) {
    let best = attackTypes.size ? 0 : Number.NaN;
    for (const atk of attackTypes) best = Math.max(best, single(atk, def));
    out.set(def, best);
  }
  return out;
}

export interface DefenseProfile {
  weak: number[]; // >1x
  resist: number[]; // <1x but >0
  immune: number[]; // 0x
}

/** Defensive profile of one mon's type pair against every attacking type. */
export function defenseProfile(types: [number, number]): DefenseProfile {
  const weak: number[] = [];
  const resist: number[] = [];
  const immune: number[] = [];
  for (const atk of CHART_TYPES) {
    const m = effectiveness(atk, types);
    if (m === 0) immune.push(atk);
    else if (m > 1) weak.push(atk);
    else if (m < 1) resist.push(atk);
  }
  return { weak, resist, immune };
}
