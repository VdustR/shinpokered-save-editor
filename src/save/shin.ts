/**
 * Shin Pokémon Red specific save data.
 *
 * Sources (shinpokered@1.25.0):
 * - `wram.asm` wUnusedD721 (d721): persisted flag byte —
 *   bit 0 female trainer (_FPLAYER builds), bit 4 60 FPS, bit 5 obedience
 *   level cap, bit 6 nuzlocke mode, bit 7 enhanced GBC colors. Bits 1-3 are
 *   battle-temp state and are left alone here.
 * - `wram.asm` wRomHackVersion (da3a) and wRandomizerSeed (da3b).
 * - `custom_functions/func_misc.asm` DetermineMonGender +
 *   `func_monlists.asm` ListByGenderRatio / GetGenderRatioTarget:
 *   gender is derived from the attack DV against a per-species threshold.
 * - `custom_functions/func_shiny.asm` ShinyDVsChecker: Gen 2 rule —
 *   def/spd/spc DVs = 10 and attack DV bit 1 set.
 */
import gamedata from "../gen/gamedata.json";
import type { Dvs } from "./pokemon";

// fileOffset = 0x25a3 + (wramAddr - 0xd2f7); see layout.ts.
export const SHIN_FLAGS_OFFSET = 0x25a3 + (0xd721 - 0xd2f7); // 0x29cd
export const ROM_HACK_VERSION_OFFSET = 0x25a3 + (0xda3a - 0xd2f7); // 0x2ce6
export const RANDOMIZER_SEED_OFFSET = 0x25a3 + (0xda3b - 0xd2f7); // 0x2ce7
/**
 * wUnusedD5A3 (d5a3): win streak against the post-E4 random-battle NPC in the
 * east-west underground path (scripts/undergroundpathwe.asm). Reaching 5
 * spawns the M.GENE reward; leaving the area resets the counter.
 */
export const WIN_STREAK_OFFSET = 0x25a3 + (0xd5a3 - 0xd2f7); // 0x284f

export type ShinFlagName = "femaleTrainer" | "sixtyFps" | "obedienceCap" | "nuzlocke" | "gbcColors";

export const SHIN_FLAG_BITS: Record<ShinFlagName, number> = {
  femaleTrainer: 0,
  sixtyFps: 4,
  obedienceCap: 5,
  nuzlocke: 6,
  gbcColors: 7,
};

export type ShinFlags = Record<ShinFlagName, boolean>;

export function getShinFlags(bytes: Uint8Array): ShinFlags {
  const byte = bytes[SHIN_FLAGS_OFFSET];
  return {
    femaleTrainer: (byte & (1 << SHIN_FLAG_BITS.femaleTrainer)) !== 0,
    sixtyFps: (byte & (1 << SHIN_FLAG_BITS.sixtyFps)) !== 0,
    obedienceCap: (byte & (1 << SHIN_FLAG_BITS.obedienceCap)) !== 0,
    nuzlocke: (byte & (1 << SHIN_FLAG_BITS.nuzlocke)) !== 0,
    gbcColors: (byte & (1 << SHIN_FLAG_BITS.gbcColors)) !== 0,
  };
}

export function setShinFlag(bytes: Uint8Array, flag: ShinFlagName, value: boolean): void {
  const mask = 1 << SHIN_FLAG_BITS[flag];
  if (value) bytes[SHIN_FLAGS_OFFSET] |= mask;
  else bytes[SHIN_FLAGS_OFFSET] &= ~mask;
}

export function getRomHackVersion(bytes: Uint8Array): number {
  return bytes[ROM_HACK_VERSION_OFFSET];
}

export function getRandomizerSeed(bytes: Uint8Array): number {
  return bytes[RANDOMIZER_SEED_OFFSET];
}

export function setRandomizerSeed(bytes: Uint8Array, seed: number): void {
  bytes[RANDOMIZER_SEED_OFFSET] = seed & 0xff;
}

export function getWinStreak(bytes: Uint8Array): number {
  return bytes[WIN_STREAK_OFFSET];
}

export function setWinStreak(bytes: Uint8Array, streak: number): void {
  // The UI never passes NaN (NumberInput guards on commit), but as a
  // standalone API a NaN would otherwise silently zero the byte.
  if (Number.isNaN(streak)) return;
  bytes[WIN_STREAK_OFFSET] = Math.min(Math.max(Math.trunc(streak), 0), 0xff);
}

// --- Gender -------------------------------------------------------------------

const GENDER_LIST: readonly number[] = gamedata.genderList as number[];

/** GetGenderRatioTarget: list-index ranges -> minimum attack DV to be male. */
function maleThreshold(index: number): number {
  if (index < 6) return 0; // male only
  if (index < 25) return 2; // 87.5% male
  if (index < 35) return 4; // 75% male
  if (index < 126) return 8; // 50/50
  if (index < 132) return 12; // 25% male
  return 16; // female only (attack DV can never reach 16)
}

export type MonGender = "male" | "female";

/**
 * Shin derives gender from the attack DV, Gen 2 style. Species not on the
 * list (Magnemite, Ditto, legendaries, ...) are genderless -> null.
 */
export function genderOf(speciesInternalId: number, atkDv: number): MonGender | null {
  const index = GENDER_LIST.indexOf(speciesInternalId);
  if (index === -1) return null;
  return atkDv >= maleThreshold(index) ? "male" : "female";
}

// --- Shininess ----------------------------------------------------------------

/** ShinyDVsChecker: def/spd/spc = 10 and attack DV bit 1 set. */
export function isShinyDvs(dvs: Dvs): boolean {
  return (dvs.atk & 0b0010) !== 0 && dvs.def === 10 && dvs.spd === 10 && dvs.spc === 10;
}

/** Minimal change to make a mon shiny: set attack bit 1, pin the rest to 10. */
export function makeShinyDvs(dvs: Dvs): Dvs {
  return { atk: dvs.atk | 0b0010, def: 10, spd: 10, spc: 10 };
}
