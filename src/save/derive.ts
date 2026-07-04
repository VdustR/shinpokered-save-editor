/**
 * Derived-field helpers: keep exp/stats/types consistent with species, level,
 * DVs, and stat exp, mirroring what the game recalculates on level-up and on
 * box withdrawal.
 */
import { baseStatsOf, moveInfo, speciesByInternalId } from "./gamedata";
import { hpDvOf, type MonRecord } from "./pokemon";
import { calcStat, expForLevel, levelForExp } from "./stats";

/** Recalculate exp band, max HP, stats, and cached types/catch rate in place. */
export function recalcDerivedFields(mon: MonRecord): void {
  const base = baseStatsOf(mon.species);
  if (!base) return; // unknown species: leave raw values untouched
  const level = Math.min(Math.max(mon.level, 1), 255);
  mon.level = level;
  mon.boxLevel = level;
  // Keep exp if it already resolves to this level; otherwise snap to the band.
  if (levelForExp(base.growthRate, mon.exp) !== level) {
    mon.exp = expForLevel(base.growthRate, Math.min(level, 100));
  }
  mon.types = [base.types[0], base.types[1]];
  mon.catchRate = base.catchRate;
  const hpDv = hpDvOf(mon.dvs);
  const maxHp = calcStat({ base: base.hp, dv: hpDv, statExp: mon.statExp.hp, level, isHp: true });
  const wasFull = mon.maxHp === undefined || mon.currentHp >= (mon.maxHp ?? 0);
  mon.maxHp = maxHp;
  mon.currentHp = wasFull ? maxHp : Math.min(mon.currentHp, maxHp);
  mon.stats = {
    atk: calcStat({ base: base.atk, dv: mon.dvs.atk, statExp: mon.statExp.atk, level, isHp: false }),
    def: calcStat({ base: base.def, dv: mon.dvs.def, statExp: mon.statExp.def, level, isHp: false }),
    spd: calcStat({ base: base.spd, dv: mon.dvs.spd, statExp: mon.statExp.spd, level, isHp: false }),
    spc: calcStat({ base: base.spc, dv: mon.dvs.spc, statExp: mon.statExp.spc, level, isHp: false }),
  };
}

/** Build a fresh legal-ish mon of a species at a level, like an in-game encounter. */
export function createMon(internalId: number, level: number): MonRecord {
  const species = speciesByInternalId(internalId);
  const base = baseStatsOf(internalId);
  const moves: number[] = [];
  if (base) {
    for (const move of base.level0Moves) moves.push(move);
  }
  if (species) {
    for (const learn of species.levelUpMoves) {
      if (learn.level <= level && !moves.includes(learn.move)) moves.push(learn.move);
    }
  }
  const lastFour = moves.slice(-4);
  while (lastFour.length < 4) lastFour.push(0);
  const mon: MonRecord = {
    species: internalId,
    currentHp: 0,
    boxLevel: level,
    status: 0,
    types: [0, 0],
    catchRate: 0,
    moves: [lastFour[0], lastFour[1], lastFour[2], lastFour[3]],
    otId: 0,
    exp: 0,
    statExp: { hp: 0, atk: 0, def: 0, spd: 0, spc: 0 },
    dvs: { atk: 0, def: 0, spd: 0, spc: 0 },
    pp: [0, 0, 0, 0],
    level,
    maxHp: 0,
    stats: { atk: 0, def: 0, spd: 0, spc: 0 },
  };
  mon.pp = mon.moves.map((moveId) => (moveId ? (moveInfo(moveId)?.pp ?? 0) : 0)) as [
    number,
    number,
    number,
    number,
  ];
  mon.exp = base ? expForLevel(base.growthRate, Math.min(level, 100)) : 0;
  recalcDerivedFields(mon);
  return mon;
}
