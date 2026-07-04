/**
 * Player overworld position: wCurMap (d35e), wYCoord (d361), wXCoord (d362).
 * On continue the game reloads the map from wCurMap and places the player at
 * the stored coordinates, so editing these three bytes is a warp — the rescue
 * for softlocked saves. Map ids/dimensions come from constants/map_constants.asm.
 */
import gamedata from "../gen/gamedata.json";

export const POSITION_OFFSETS = {
  map: 0x25a3 + (0xd35e - 0xd2f7), // 0x260a
  y: 0x25a3 + (0xd361 - 0xd2f7), // 0x260d
  x: 0x25a3 + (0xd362 - 0xd2f7), // 0x260e
} as const;

export interface GameMap {
  name: string;
  width: number;
  height: number;
}

export const MAPS: readonly GameMap[] = gamedata.maps as GameMap[];

export interface Position {
  map: number;
  x: number;
  y: number;
}

export function getPosition(bytes: Uint8Array): Position {
  return {
    map: bytes[POSITION_OFFSETS.map],
    x: bytes[POSITION_OFFSETS.x],
    y: bytes[POSITION_OFFSETS.y],
  };
}

export function setPosition(bytes: Uint8Array, position: Position): void {
  bytes[POSITION_OFFSETS.map] = position.map & 0xff;
  bytes[POSITION_OFFSETS.x] = position.x & 0xff;
  bytes[POSITION_OFFSETS.y] = position.y & 0xff;
}

/** "PALLET_TOWN" -> "Pallet Town"; unknown ids get a hex label. */
export function mapName(id: number): string {
  const map = MAPS[id];
  if (!map) return `Map $${id.toString(16).toUpperCase()}`;
  return map.name
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
