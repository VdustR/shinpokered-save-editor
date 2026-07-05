/**
 * Per-mon legality report: flags values normal play cannot produce and
 * values the game itself will rewrite (e.g. on box deposit).
 *
 * Severities: "bad" = impossible in normal play / glitch territory;
 * "warn" = inconsistent with derived rules, the game may rewrite or
 * behave oddly; "info" = noteworthy but harmless.
 */
import { SPECIES, TM_MOVES, baseStatsOf, moveInfo, moveName, speciesByInternalId, speciesName } from "./gamedata";
import { moveLegality, type LearnSource } from "./legality";
import { calcStat, levelForExp } from "./stats";
import { hpDvOf, maxPp, ppCurrent, ppUps, type MonRecord } from "./pokemon";
import type { MonNames } from "./savefile";
import { isEncodable } from "./text";

export type Severity = "bad" | "warn" | "info";

export interface Finding {
  severity: Severity;
  /** Short grouping label, e.g. "Moves", "EXP". */
  area: string;
  message: string;
}

const SOURCE_LABEL: Record<LearnSource, string> = {
  levelup: "level-up",
  tm: "TM",
  hm: "HM",
  prevo: "pre-evolution",
};

// Species that evolve into `id` — mirrors the private map in legality.ts.
const preEvos = new Map<number, number[]>();
for (const s of SPECIES) {
  for (const evo of s.evolutions) {
    const list = preEvos.get(evo.into) ?? [];
    list.push(s.internalId);
    preEvos.set(evo.into, list);
  }
}

/** Can the species line learn this move from a TM/HM (no level floor)? */
export function tmLearnable(internalId: number, moveId: number): boolean {
  const visited = new Set<number>();
  const queue = [internalId];
  while (queue.length) {
    const id = queue.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const base = baseStatsOf(id);
    for (const n of base?.tmhm ?? []) if (TM_MOVES[n - 1] === moveId) return true;
    for (const prev of preEvos.get(id) ?? []) queue.push(prev);
  }
  return false;
}

/**
 * Lowest level at which the species line can know a move through level-up.
 * TM/HM moves have no level floor. Returns null when no level-up path exists.
 */
export function minLearnLevel(internalId: number, moveId: number): number | null {
  let min: number | null = null;
  const visited = new Set<number>();
  const queue = [internalId];
  while (queue.length) {
    const id = queue.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const base = baseStatsOf(id);
    if (base?.level0Moves.includes(moveId)) min = 1;
    const species = speciesByInternalId(id);
    for (const lm of species?.levelUpMoves ?? []) {
      if (lm.move === moveId && (min === null || lm.level < min)) min = lm.level;
    }
    for (const prev of preEvos.get(id) ?? []) queue.push(prev);
  }
  return min;
}

export function legalityReport(mon: MonRecord, names?: MonNames): Finding[] {
  const findings: Finding[] = [];
  const species = speciesByInternalId(mon.species);
  const base = baseStatsOf(mon.species);

  if (!species || !base) {
    findings.push({
      severity: "bad",
      area: "Species",
      message: `Internal id ${mon.species} is not a real species — this is a glitch mon.`,
    });
    return findings; // everything downstream would be nonsense
  }

  if (mon.level < 1 || mon.level > 100) {
    findings.push({
      severity: "bad",
      area: "Level",
      message: `Level ${mon.level} is outside 1–100; normal play caps at 100.`,
    });
  } else {
    const expLevel = levelForExp(base.growthRate, mon.exp);
    if (expLevel !== mon.level) {
      findings.push({
        severity: "warn",
        area: "EXP",
        message: `EXP ${mon.exp.toLocaleString()} corresponds to level ${expLevel}, not ${mon.level}; the game recalculates level from EXP on box deposit.`,
      });
    }
  }

  const seen = new Map<number, number>();
  for (const id of mon.moves) if (id) seen.set(id, (seen.get(id) ?? 0) + 1);
  for (const [id, count] of seen) {
    if (count > 1)
      findings.push({
        severity: "bad",
        area: "Moves",
        message: `${moveName(id)} appears ${count} times; the game never assigns duplicate moves.`,
      });
  }
  if ([...seen.values()].reduce((a, b) => a + b, 0) === 0) {
    findings.push({
      severity: "bad",
      area: "Moves",
      message: "No moves at all — the game always keeps at least one move.",
    });
  }

  mon.moves.forEach((id, slot) => {
    if (!id) return;
    const info = moveInfo(id);
    if (!info) {
      findings.push({
        severity: "bad",
        area: "Moves",
        message: `Slot ${slot + 1} holds unknown move id ${id} — glitch move.`,
      });
      return;
    }
    const legal = moveLegality(mon.species, id);
    if (!legal) {
      findings.push({
        severity: "warn",
        area: "Moves",
        message: `${info.name}: ${speciesName(mon.species)} (and its pre-evolutions) cannot learn this in normal play.`,
      });
    } else if ((legal.source === "levelup" || legal.source === "prevo") && !tmLearnable(mon.species, id)) {
      // A TM/HM path has no level floor, so only pure level-up moves get one.
      const lvl = minLearnLevel(mon.species, id);
      if (lvl !== null && lvl > mon.level) {
        findings.push({
          severity: "warn",
          area: "Moves",
          message: `${info.name} is first learnable at level ${lvl} (${SOURCE_LABEL[legal.source]}); this mon is level ${mon.level}.`,
        });
      }
    }
    const ups = ppUps(mon.pp[slot]);
    const cap = maxPp(info.pp, ups);
    if (ppCurrent(mon.pp[slot]) > cap) {
      findings.push({
        severity: "bad",
        area: "PP",
        message: `${info.name}: current PP ${ppCurrent(mon.pp[slot])} exceeds the maximum ${cap} for ${ups} PP Up(s).`,
      });
    }
  });

  if (mon.types[0] !== base.types[0] || mon.types[1] !== base.types[1]) {
    findings.push({
      severity: "info",
      area: "Types",
      message: "Stored type bytes differ from the species' real types; battles use the stored bytes.",
    });
  }
  if (mon.catchRate !== base.catchRate) {
    findings.push({
      severity: "info",
      area: "Catch rate",
      message: `Stored catch rate ${mon.catchRate} differs from the species value ${base.catchRate}; it is kept on capture in Gen 1, so this can be legitimate for evolved or traded mons.`,
    });
  }

  if (mon.level >= 1 && mon.level <= 100) {
    const derivedMaxHp = calcStat({
      base: base.hp,
      dv: hpDvOf(mon.dvs),
      statExp: mon.statExp.hp,
      level: mon.level,
      isHp: true,
    });
    const cap = mon.maxHp ?? derivedMaxHp;
    if (mon.currentHp > cap) {
      findings.push({
        severity: "warn",
        area: "Stats",
        message: `Current HP ${mon.currentHp} exceeds ${
          mon.maxHp !== undefined ? `max HP ${cap}` : `the derived max HP ${cap}`
        }.`,
      });
    }
  }

  if (mon.stats && mon.maxHp !== undefined && mon.level >= 1 && mon.level <= 100) {
    const expect = {
      hp: calcStat({ base: base.hp, dv: hpDvOf(mon.dvs), statExp: mon.statExp.hp, level: mon.level, isHp: true }),
      atk: calcStat({ base: base.atk, dv: mon.dvs.atk, statExp: mon.statExp.atk, level: mon.level, isHp: false }),
      def: calcStat({ base: base.def, dv: mon.dvs.def, statExp: mon.statExp.def, level: mon.level, isHp: false }),
      spd: calcStat({ base: base.spd, dv: mon.dvs.spd, statExp: mon.statExp.spd, level: mon.level, isHp: false }),
      spc: calcStat({ base: base.spc, dv: mon.dvs.spc, statExp: mon.statExp.spc, level: mon.level, isHp: false }),
    };
    const diffs: string[] = [];
    if (mon.maxHp !== expect.hp) diffs.push(`HP ${mon.maxHp}≠${expect.hp}`);
    if (mon.stats.atk !== expect.atk) diffs.push(`ATK ${mon.stats.atk}≠${expect.atk}`);
    if (mon.stats.def !== expect.def) diffs.push(`DEF ${mon.stats.def}≠${expect.def}`);
    if (mon.stats.spd !== expect.spd) diffs.push(`SPD ${mon.stats.spd}≠${expect.spd}`);
    if (mon.stats.spc !== expect.spc) diffs.push(`SPC ${mon.stats.spc}≠${expect.spc}`);
    if (diffs.length) {
      findings.push({
        severity: "warn",
        area: "Stats",
        message: `Stored stats differ from the formula for these DVs/EXP (${diffs.join(", ")}); the game recalculates them on box deposit.`,
      });
    }
  }

  if (names) {
    if (!isEncodable(names.nickname)) {
      findings.push({
        severity: "bad",
        area: "Names",
        message: "Nickname contains characters the game cannot store.",
      });
    }
    if (!isEncodable(names.otName)) {
      findings.push({
        severity: "bad",
        area: "Names",
        message: "OT name contains characters the game cannot store.",
      });
    }
  }

  return findings;
}
