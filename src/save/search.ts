/** Fuzzy search + filtering over the species, move, and item encyclopedias. */
import { DEX_SPECIES, ITEMS, MOVES, baseStatsOf, type ItemEntry, type MoveEntry, type SpeciesEntry } from "./gamedata";

/**
 * Subsequence fuzzy match. Returns a score (lower is better) when every query
 * character appears in `text` in order, or null when it doesn't. Contiguous
 * runs and early matches score better, so substrings/prefixes rank first.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  if (q === "") return 0;
  const t = text.toLowerCase();
  let ti = 0;
  let score = 0;
  let lastMatch = -1;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    // Penalize gaps between consecutive matched characters and a late start.
    if (lastMatch >= 0) score += found - lastMatch - 1;
    else score += found;
    lastMatch = found;
    ti = found + 1;
  }
  return score;
}

export type MoveSort = "name" | "type" | "power" | "accuracy" | "pp";
export type SortDir = "asc" | "desc";

export interface MoveQuery {
  query?: string;
  type?: number;
  sort?: MoveSort;
  dir?: SortDir;
}

export function searchMoves({ query = "", type, sort = "name", dir = "asc" }: MoveQuery): MoveEntry[] {
  const scored: { move: MoveEntry; score: number }[] = [];
  for (const move of MOVES) {
    if (type !== undefined && move.type !== type) continue;
    const score = fuzzyScore(query, move.name);
    if (score === null) continue;
    scored.push({ move, score });
  }
  const sign = dir === "desc" ? -1 : 1;
  scored.sort((a, b) => {
    // With an active query and default sort, rank by match quality first.
    if (query.trim() !== "" && sort === "name") {
      if (a.score !== b.score) return a.score - b.score;
      return a.move.name.localeCompare(b.move.name);
    }
    switch (sort) {
      case "power":
        return sign * (a.move.power - b.move.power) || a.move.name.localeCompare(b.move.name);
      case "accuracy":
        return sign * (a.move.accuracy - b.move.accuracy) || a.move.name.localeCompare(b.move.name);
      case "pp":
        return sign * (a.move.pp - b.move.pp) || a.move.name.localeCompare(b.move.name);
      case "type":
        return sign * (a.move.type - b.move.type) || a.move.name.localeCompare(b.move.name);
      default:
        return sign * a.move.name.localeCompare(b.move.name);
    }
  });
  return scored.map((s) => s.move);
}

export type SpeciesSort = "dex" | "name" | "bst";

export interface SpeciesResult extends SpeciesEntry {
  /** Base stat total (sum of the five Gen 1 base stats), 0 if stats unknown. */
  bst: number;
  types: [number, number];
}

export interface SpeciesQuery {
  query?: string;
  type?: number;
  sort?: SpeciesSort;
  dir?: SortDir;
}

export function searchSpecies({ query = "", type, sort = "dex", dir = "asc" }: SpeciesQuery): SpeciesResult[] {
  const scored: { entry: SpeciesResult; score: number }[] = [];
  for (const species of DEX_SPECIES) {
    const base = baseStatsOf(species.internalId);
    if (type !== undefined && !(base && (base.types[0] === type || base.types[1] === type))) continue;
    const score = fuzzyScore(query, species.name);
    if (score === null) continue;
    const bst = base ? base.hp + base.atk + base.def + base.spd + base.spc : 0;
    scored.push({ entry: { ...species, bst, types: base ? [base.types[0], base.types[1]] : [0, 0] }, score });
  }
  const sign = dir === "desc" ? -1 : 1;
  scored.sort((a, b) => {
    if (query.trim() !== "" && sort === "dex" && a.score !== b.score) return a.score - b.score;
    switch (sort) {
      case "name":
        return sign * a.entry.name.localeCompare(b.entry.name);
      case "bst":
        return sign * (a.entry.bst - b.entry.bst) || a.entry.dexNo - b.entry.dexNo;
      default:
        return sign * (a.entry.dexNo - b.entry.dexNo);
    }
  });
  return scored.map((s) => s.entry);
}

export type ItemCategory = "all" | "tm" | "hm" | "regular";

export interface ItemQuery {
  query?: string;
  category?: ItemCategory;
}

export function searchItems({ query = "", category = "all" }: ItemQuery): ItemEntry[] {
  const scored: { item: ItemEntry; score: number }[] = [];
  for (const item of ITEMS) {
    if (category === "tm" && item.tm === undefined) continue;
    if (category === "hm" && item.hm === undefined) continue;
    if (category === "regular" && (item.tm !== undefined || item.hm !== undefined)) continue;
    const score = fuzzyScore(query, item.name);
    if (score === null) continue;
    scored.push({ item, score });
  }
  scored.sort((a, b) => {
    if (query.trim() !== "" && a.score !== b.score) return a.score - b.score;
    return a.item.id - b.item.id;
  });
  return scored.map((s) => s.item);
}
