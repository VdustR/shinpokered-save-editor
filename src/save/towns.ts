/**
 * Visited towns: wTownVisitedFlag (d70b, 2 bytes) is a bit array indexed by
 * town map id ($00-$0A). The overworld marks a town visited on entry
 * (engine/overworld/missable_objects.asm: "mark town as visited (for
 * flying)"), and the Fly/town-map code reads the same bits, so setting a bit
 * unlocks that Fly destination. Indigo Plateau has a bit for the town map but
 * is not a Fly destination in-game.
 */

export const TOWNS_VISITED_OFFSET = 0x25a3 + (0xd70b - 0xd2f7); // 0x29b7

export interface Town {
  /** Map id == bit index in wTownVisitedFlag. */
  mapId: number;
  name: string;
}

/** Map order from constants/map_constants.asm ($00-$0A). */
export const TOWNS: readonly Town[] = [
  { mapId: 0, name: "Pallet Town" },
  { mapId: 1, name: "Viridian City" },
  { mapId: 2, name: "Pewter City" },
  { mapId: 3, name: "Cerulean City" },
  { mapId: 4, name: "Lavender Town" },
  { mapId: 5, name: "Vermilion City" },
  { mapId: 6, name: "Celadon City" },
  { mapId: 7, name: "Fuchsia City" },
  { mapId: 8, name: "Cinnabar Island" },
  { mapId: 9, name: "Indigo Plateau" },
  { mapId: 10, name: "Saffron City" },
];

export function getTownVisited(bytes: Uint8Array, mapId: number): boolean {
  return (bytes[TOWNS_VISITED_OFFSET + (mapId >> 3)] & (1 << (mapId & 7))) !== 0;
}

export function setTownVisited(bytes: Uint8Array, mapId: number, value: boolean): void {
  const offset = TOWNS_VISITED_OFFSET + (mapId >> 3);
  const mask = 1 << (mapId & 7);
  if (value) bytes[offset] |= mask;
  else bytes[offset] &= ~mask;
}
