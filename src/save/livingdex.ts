/**
 * Living-dex filler: add one of every missing species to the PC boxes.
 */
import { createMon } from "./derive";
import { DEX_SPECIES } from "./gamedata";
import { MONS_PER_BOX } from "./layout";
import {
  getDayCare,
  getParty,
  getPlayerId,
  markBoxesInitialized,
  readBox,
  setDexOwned,
  setDexSeen,
  writeBoxMon,
} from "./savefile";

export const LIVING_DEX_LEVEL = 5;
const BOX_COUNT = 12;

export interface LivingDexResult {
  added: number;
  /** Species that could not be placed because every box filled up. */
  skippedForSpace: number;
}

/** Every species internal id already present in the save (party, boxes, day care). */
function presentSpecies(bytes: Uint8Array): Set<number> {
  const present = new Set<number>();
  for (const slot of getParty(bytes)) present.add(slot.mon.species);
  for (let box = 0; box < BOX_COUNT; box++) {
    for (const slot of readBox(bytes, box).mons) present.add(slot.mon.species);
  }
  const dayCare = getDayCare(bytes);
  if (dayCare.inUse && dayCare.mon) present.add(dayCare.mon.mon.species);
  return present;
}

/**
 * Fill empty box slots with one Lv5 mon of each species missing from the
 * save, in Pokédex order, marking each as seen and owned. Existing mons are
 * never touched; fills stop when the boxes run out of space.
 */
export function fillLivingDex(bytes: Uint8Array, otName: string): LivingDexResult {
  const present = presentSpecies(bytes);
  const missing = DEX_SPECIES.filter((sp) => !present.has(sp.internalId));
  // A living dex means a complete Pokédex too: species already in the save
  // may have unset dex bits on edited or imported files.
  for (const sp of DEX_SPECIES) {
    if (present.has(sp.internalId)) {
      setDexSeen(bytes, sp.dexNo, true);
      setDexOwned(bytes, sp.dexNo, true);
    }
  }
  // Match the save's trainer ID; a mismatched OT id/name makes Gen 1 treat
  // the mon as traded (boosted EXP, possible disobedience).
  const otId = getPlayerId(bytes);

  let added = 0;
  let box = 0;
  let slot = readBox(bytes, 0).mons.length;
  for (const sp of missing) {
    while (box < BOX_COUNT && slot >= MONS_PER_BOX) {
      box++;
      if (box < BOX_COUNT) slot = readBox(bytes, box).mons.length;
    }
    if (box >= BOX_COUNT) break;
    const mon = createMon(sp.internalId, LIVING_DEX_LEVEL);
    mon.otId = otId;
    writeBoxMon(bytes, box, slot, mon, { nickname: sp.name, otName });
    setDexSeen(bytes, sp.dexNo, true);
    setDexOwned(bytes, sp.dexNo, true);
    slot++;
    added++;
  }
  // Stored boxes written before the first in-game box switch would be wiped
  // by the game's EmptyAllSRAMBoxes; mark them initialized so they survive.
  if (added > 0) markBoxesInitialized(bytes);
  return { added, skippedForSpace: missing.length - added };
}
