import { ITEM_SORT_ORDER } from "./gamedata";
import type { ItemStack } from "./savefile";

/** Pure array reorder helper shared by the reorder UIs. */
export function moveInArray<T>(arr: readonly T[], from: number, to: number): T[] {
  const out = arr.slice();
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

/**
 * Sort item stacks into the game's built-in bag/PC order (shinpokered
 * ItemSortList). Items not in that list keep their relative order and go after
 * the listed ones, matching the in-game "hold SELECT + START" sort.
 */
export function autoSortItems(items: readonly ItemStack[]): ItemStack[] {
  const rank = new Map<number, number>();
  ITEM_SORT_ORDER.forEach((id, i) => rank.set(id, i));
  const fallback = ITEM_SORT_ORDER.length;
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ra = rank.get(a.item.id) ?? fallback;
      const rb = rank.get(b.item.id) ?? fallback;
      return ra - rb || a.index - b.index; // stable for unlisted items
    })
    .map((x) => x.item);
}
