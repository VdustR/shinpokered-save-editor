/**
 * Overworld item balls are missable objects: wMissableObjectFlags (d5a6,
 * file 0x2852) is a bit array indexed by the HS_* constant value, and a set
 * bit hides the object — i.e. the ball has been picked up. Clearing a bit
 * makes the ball reappear. Only the HS_*_ITEM entries are exposed here; the
 * same array also drives NPC visibility, which is story-coupled and stays in
 * the hex view.
 */
import gamedata from "../gen/gamedata.json";
import { itemName } from "./gamedata";

export const MISSABLES_OFFSET = 0x25a3 + (0xd5a6 - 0xd2f7); // 0x2852

export interface MissableBall {
  /** HS_* constant value == bit index. */
  index: number;
  map: string;
  item: number | null;
}

export const MISSABLE_BALLS: readonly MissableBall[] = gamedata.missableBalls as MissableBall[];

export function getMissable(bytes: Uint8Array, index: number): boolean {
  return (bytes[MISSABLES_OFFSET + (index >> 3)] & (1 << (index & 7))) !== 0;
}

export function setMissable(bytes: Uint8Array, index: number, value: boolean): void {
  const offset = MISSABLES_OFFSET + (index >> 3);
  const mask = 1 << (index & 7);
  if (value) bytes[offset] |= mask;
  else bytes[offset] &= ~mask;
}

/** Display fixups over the plain word-capitalized map constant. */
const MAP_LABEL_FIXUPS: [RegExp, string][] = [
  [/^Ss Anne/, "S.S. Anne"],
  [/^Mt Moon/, "Mt. Moon"],
  [/^Silph Co (\d+)f?$/, "Silph Co. $1F"],
  [/^Undpathwe$/, "Underground Path (W-E)"],
  [/ (\d+)f$/, " $1F"],
];

/** "ROUTE_2" + item id -> "Route 2 — MOON STONE". */
export function ballLabel(ball: MissableBall): string {
  let map = ball.map
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  for (const [pattern, replacement] of MAP_LABEL_FIXUPS) map = map.replace(pattern, replacement);
  return `${map} — ${ball.item !== null ? itemName(ball.item) : "?"}`;
}
