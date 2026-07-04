/** Fuzzy search + filtering over the move and item encyclopedias. */
import { ITEMS, MOVES, type ItemEntry, type MoveEntry } from "./gamedata";

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
