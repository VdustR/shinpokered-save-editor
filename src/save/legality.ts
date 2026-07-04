/**
 * Move legality: can a species legally know a move via normal play?
 *
 * A move is legal for a species if it appears in that species' own level-up
 * learnset (including its initial level-0 moves), its TM/HM compatibility, or
 * the legal move pool of any pre-evolution (Gen 1 mons keep moves learned
 * before evolving). Anything else is illegal ("爆規").
 *
 * Data comes from the generated shinpokered profile, so this reflects Shin's
 * learnsets, not vanilla Gen 1.
 */
import { SPECIES, TM_MOVES, baseStatsOf, speciesByInternalId } from "./gamedata";

export type LearnSource = "levelup" | "tm" | "hm" | "prevo";

export interface Legality {
  source: LearnSource;
}

// internalId -> list of pre-evolution internalIds (species that evolve into it).
const preEvoMap = new Map<number, number[]>();
for (const species of SPECIES) {
  for (const evo of species.evolutions) {
    const list = preEvoMap.get(evo.into) ?? [];
    list.push(species.internalId);
    preEvoMap.set(evo.into, list);
  }
}

const directCache = new Map<number, Map<number, LearnSource>>();
const fullCache = new Map<number, Map<number, LearnSource>>();

/** Moves this species learns directly (its own level-up + TM/HM), best source first. */
function directLearnset(internalId: number): Map<number, LearnSource> {
  const cached = directCache.get(internalId);
  if (cached) return cached;
  const learn = new Map<number, LearnSource>();
  const base = baseStatsOf(internalId);
  const species = speciesByInternalId(internalId);
  if (base) for (const moveId of base.level0Moves) if (moveId) learn.set(moveId, "levelup");
  if (species) for (const { move } of species.levelUpMoves) if (!learn.has(move)) learn.set(move, "levelup");
  if (base) {
    for (const n of base.tmhm) {
      const moveId = TM_MOVES[n - 1];
      if (!moveId || learn.has(moveId)) continue;
      learn.set(moveId, n <= 50 ? "tm" : "hm");
    }
  }
  directCache.set(internalId, learn);
  return learn;
}

/**
 * Full legal move pool for a species: its own direct learnset plus every
 * pre-evolution's direct moves (labelled "prevo"). Uses a per-call visited set
 * over the pre-evo closure — computed only from the always-complete direct
 * learnsets — so the cached result is always complete and cycle-safe.
 */
function fullLearnset(internalId: number): Map<number, LearnSource> {
  const cached = fullCache.get(internalId);
  if (cached) return cached;

  const learn = new Map<number, LearnSource>(directLearnset(internalId));
  const visited = new Set<number>([internalId]);
  const queue = [...(preEvoMap.get(internalId) ?? [])];
  while (queue.length > 0) {
    const preId = queue.shift()!;
    if (visited.has(preId)) continue;
    visited.add(preId);
    for (const [moveId] of directLearnset(preId)) if (!learn.has(moveId)) learn.set(moveId, "prevo");
    for (const grandPre of preEvoMap.get(preId) ?? []) queue.push(grandPre);
  }
  fullCache.set(internalId, learn);
  return learn;
}

/** How a species can legally learn a move, or null if it can't. */
export function moveLegality(internalId: number, moveId: number): Legality | null {
  if (!moveId) return null;
  const source = fullLearnset(internalId).get(moveId);
  return source ? { source } : null;
}

/** Set of every move id a species can legally learn. */
export function learnableMoves(internalId: number): Set<number> {
  return new Set(fullLearnset(internalId).keys());
}

export const LEARN_SOURCE_LABEL: Record<LearnSource, string> = {
  levelup: "Lv",
  tm: "TM",
  hm: "HM",
  prevo: "Pre-evo",
};
