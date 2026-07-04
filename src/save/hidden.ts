/**
 * Hidden item / hidden coin pickup flags.
 *
 * The overworld pickup code finds the row index of (map, y, x) in
 * HiddenItemCoords / HiddenCoinCoords and uses it as the bit index into
 * wObtainedHiddenItemsFlags (d6f0, 14 bytes) / wObtainedHiddenCoinsFlags
 * (d6fe, 2 bytes). Clearing a bit makes that hidden pickup available again.
 * Spot lists (with item ids joined from hidden_objects.asm) come from the
 * data generator.
 */
import gamedata from "../gen/gamedata.json";
import { itemName } from "./gamedata";

export const HIDDEN_ITEMS_OFFSET = 0x25a3 + (0xd6f0 - 0xd2f7); // 0x299c
export const HIDDEN_COINS_OFFSET = 0x25a3 + (0xd6fe - 0xd2f7); // 0x29aa

export interface HiddenSpot {
  map: string;
  x: number;
  y: number;
  /** Item id for hidden items; null for coins (and the rare unresolved spot). */
  item: number | null;
}

export const HIDDEN_ITEMS: readonly HiddenSpot[] = gamedata.hiddenItems as HiddenSpot[];
export const HIDDEN_COINS: readonly HiddenSpot[] = gamedata.hiddenCoins as HiddenSpot[];

export function getHiddenFlag(bytes: Uint8Array, baseOffset: number, index: number): boolean {
  return (bytes[baseOffset + (index >> 3)] & (1 << (index & 7))) !== 0;
}

export function setHiddenFlag(bytes: Uint8Array, baseOffset: number, index: number, value: boolean): void {
  const offset = baseOffset + (index >> 3);
  const mask = 1 << (index & 7);
  if (value) bytes[offset] |= mask;
  else bytes[offset] &= ~mask;
}

/** "VIRIDIAN_FOREST" -> "Viridian Forest". */
function prettyMapName(constant: string): string {
  return constant
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function hiddenSpotLabel(spot: HiddenSpot, fallback = "?"): string {
  const what = spot.item !== null ? itemName(spot.item) : fallback;
  return `${prettyMapName(spot.map)} — ${what} (${spot.x}, ${spot.y})`;
}
