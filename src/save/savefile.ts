/**
 * Field accessors over the raw 32 KiB save buffer.
 *
 * The buffer itself is the single source of truth: setters write exactly the
 * bytes a field owns, so an untouched save always exports byte-for-byte
 * identical (checksums are only rewritten when they no longer match).
 */
import { decodeBcd, encodeBcd } from "./bcd";
import {
  listChecksumMismatches,
  repairChecksums,
  repairDirtyChecksums,
  type ChecksumGroup,
} from "./checksum";
import {
  BAG_CAPACITY,
  BOX_MON_SIZE,
  MONS_PER_BOX,
  NAME_LENGTH,
  NUM_BOXES,
  OFFSETS,
  PARTY_LENGTH,
  PARTY_MON_SIZE,
  PC_ITEM_CAPACITY,
  SAVE_SIZE,
  storedBoxOffset,
} from "./layout";
import { readMon, writeMon, type MonRecord } from "./pokemon";
import { moveInArray } from "./reorder";
import { decodeName, encodeText } from "./text";

// --- Parse / export -----------------------------------------------------------

export interface ParsedSave {
  bytes: Uint8Array;
  warnings: string[];
  checksumMismatches: ChecksumGroup[];
}

export function parseSave(input: Uint8Array): ParsedSave {
  if (input.length < SAVE_SIZE) {
    throw new Error(`Not a Gen 1 battery save: expected at least 32 KiB (0x8000), got ${input.length} bytes`);
  }
  const warnings: string[] = [];
  if (input.length > SAVE_SIZE) {
    warnings.push(
      `File is ${input.length} bytes; using the first 32 KiB and ignoring ${input.length - SAVE_SIZE} trailing bytes (emulator padding).`,
    );
  }
  const bytes = Uint8Array.from(input.subarray(0, SAVE_SIZE));
  return { bytes, warnings, checksumMismatches: listChecksumMismatches(bytes) };
}

export interface ExportResult {
  bytes: Uint8Array;
  repaired: ChecksumGroup[];
}

/**
 * Produce the file to download. Checksums are repaired only for groups whose
 * data changed relative to `original`, so an untouched save round-trips
 * byte-for-byte (a fresh game leaves PC box checksums uninitialized, and we
 * must not "fix" bytes the game itself never wrote).
 *
 * When `original` is omitted, every mismatched checksum is repaired.
 */
export function exportSaveWithReport(bytes: Uint8Array, original?: Uint8Array): ExportResult {
  const out = Uint8Array.from(bytes);
  const repaired = original ? repairDirtyChecksums(out, original) : repairChecksums(out);
  return { bytes: out, repaired };
}

export function exportSave(bytes: Uint8Array, original?: Uint8Array): Uint8Array {
  return exportSaveWithReport(bytes, original).bytes;
}

// --- Trainer -------------------------------------------------------------------

/** True if `name` fits a Gen 1 name field (≤10 storable characters). */
export function isEncodableName(name: string): boolean {
  if (name.length > NAME_LENGTH - 1) return false;
  try {
    encodeText(name, NAME_LENGTH);
    return true;
  } catch {
    return false;
  }
}

export function getPlayerName(bytes: Uint8Array): string {
  return decodeName(bytes.subarray(OFFSETS.playerName, OFFSETS.playerName + NAME_LENGTH));
}

export function setPlayerName(bytes: Uint8Array, name: string): void {
  bytes.set(encodeText(name, NAME_LENGTH), OFFSETS.playerName);
}

export function getRivalName(bytes: Uint8Array): string {
  return decodeName(bytes.subarray(OFFSETS.rivalName, OFFSETS.rivalName + NAME_LENGTH));
}

export function setRivalName(bytes: Uint8Array, name: string): void {
  bytes.set(encodeText(name, NAME_LENGTH), OFFSETS.rivalName);
}

export const MAX_MONEY = 999_999;
export const MAX_COINS = 9_999;

export function getMoney(bytes: Uint8Array): number {
  return decodeBcd(bytes.subarray(OFFSETS.money, OFFSETS.money + 3));
}

export function setMoney(bytes: Uint8Array, value: number): void {
  bytes.set(encodeBcd(value, 3), OFFSETS.money);
}

export function getCoins(bytes: Uint8Array): number {
  return decodeBcd(bytes.subarray(OFFSETS.coins, OFFSETS.coins + 2));
}

export function setCoins(bytes: Uint8Array, value: number): void {
  bytes.set(encodeBcd(value, 2), OFFSETS.coins);
}

export function getPlayerId(bytes: Uint8Array): number {
  return (bytes[OFFSETS.playerId] << 8) | bytes[OFFSETS.playerId + 1];
}

export function setPlayerId(bytes: Uint8Array, value: number): void {
  bytes[OFFSETS.playerId] = (value >> 8) & 0xff;
  bytes[OFFSETS.playerId + 1] = value & 0xff;
}

export const BADGE_NAMES = [
  "Boulder",
  "Cascade",
  "Thunder",
  "Rainbow",
  "Soul",
  "Marsh",
  "Volcano",
  "Earth",
] as const;

export function getBadges(bytes: Uint8Array): boolean[] {
  const value = bytes[OFFSETS.badges];
  return BADGE_NAMES.map((_, bit) => Boolean((value >> bit) & 1));
}

export function setBadge(bytes: Uint8Array, bit: number, earned: boolean): void {
  if (earned) bytes[OFFSETS.badges] |= 1 << bit;
  else bytes[OFFSETS.badges] &= ~(1 << bit) & 0xff;
}

export interface GameOptions {
  /** 1 = fast, 3 = medium, 5 = slow (wOptions bits 0-3). */
  textSpeed: number;
  battleAnimationOff: boolean;
  battleStyleSet: boolean;
}

export function getOptions(bytes: Uint8Array): GameOptions {
  const value = bytes[OFFSETS.options];
  return {
    textSpeed: value & 0x0f,
    battleAnimationOff: Boolean(value & 0x80),
    battleStyleSet: Boolean(value & 0x40),
  };
}

export function setOptions(bytes: Uint8Array, options: GameOptions): void {
  bytes[OFFSETS.options] =
    (options.textSpeed & 0x0f) | (options.battleStyleSet ? 0x40 : 0) | (options.battleAnimationOff ? 0x80 : 0);
}

export interface PlayTime {
  hours: number;
  minutes: number;
  seconds: number;
  maxed: boolean;
}

export function getPlayTime(bytes: Uint8Array): PlayTime {
  return {
    hours: bytes[OFFSETS.playTimeHours],
    minutes: bytes[OFFSETS.playTimeMinutes],
    seconds: bytes[OFFSETS.playTimeSeconds],
    maxed: bytes[OFFSETS.playTimeMaxed] !== 0,
  };
}

export function setPlayTime(bytes: Uint8Array, time: PlayTime): void {
  bytes[OFFSETS.playTimeHours] = time.hours & 0xff;
  bytes[OFFSETS.playTimeMinutes] = time.minutes & 0xff;
  bytes[OFFSETS.playTimeSeconds] = time.seconds & 0xff;
  bytes[OFFSETS.playTimeMaxed] = time.maxed ? 1 : 0;
}

// --- Pokédex ---------------------------------------------------------------------

function dexBit(dexNo: number): { offset: number; mask: number } {
  const index = dexNo - 1;
  return { offset: index >> 3, mask: 1 << (index & 7) };
}

export function isDexOwned(bytes: Uint8Array, dexNo: number): boolean {
  const { offset, mask } = dexBit(dexNo);
  return Boolean(bytes[OFFSETS.pokedexOwned + offset] & mask);
}

export function setDexOwned(bytes: Uint8Array, dexNo: number, owned: boolean): void {
  const { offset, mask } = dexBit(dexNo);
  if (owned) bytes[OFFSETS.pokedexOwned + offset] |= mask;
  else bytes[OFFSETS.pokedexOwned + offset] &= ~mask & 0xff;
}

export function isDexSeen(bytes: Uint8Array, dexNo: number): boolean {
  const { offset, mask } = dexBit(dexNo);
  return Boolean(bytes[OFFSETS.pokedexSeen + offset] & mask);
}

export function setDexSeen(bytes: Uint8Array, dexNo: number, seen: boolean): void {
  const { offset, mask } = dexBit(dexNo);
  if (seen) bytes[OFFSETS.pokedexSeen + offset] |= mask;
  else bytes[OFFSETS.pokedexSeen + offset] &= ~mask & 0xff;
}

// --- Item lists ---------------------------------------------------------------------

export interface ItemStack {
  id: number;
  count: number;
}

function getItemList(bytes: Uint8Array, countOffset: number, capacity: number): ItemStack[] {
  const count = Math.min(bytes[countOffset], capacity);
  const items: ItemStack[] = [];
  for (let i = 0; i < count; i++) {
    const base = countOffset + 1 + i * 2;
    items.push({ id: bytes[base], count: bytes[base + 1] });
  }
  return items;
}

function setItemList(bytes: Uint8Array, countOffset: number, capacity: number, items: ItemStack[]): void {
  if (items.length > capacity) {
    throw new Error(`Item list exceeds capacity: ${items.length} > ${capacity}`);
  }
  bytes[countOffset] = items.length;
  items.forEach((item, i) => {
    const base = countOffset + 1 + i * 2;
    bytes[base] = item.id & 0xff;
    bytes[base + 1] = item.count & 0xff;
  });
  bytes[countOffset + 1 + items.length * 2] = 0xff;
}

export function getBagItems(bytes: Uint8Array): ItemStack[] {
  return getItemList(bytes, OFFSETS.bagItemCount, BAG_CAPACITY);
}

export function setBagItems(bytes: Uint8Array, items: ItemStack[]): void {
  setItemList(bytes, OFFSETS.bagItemCount, BAG_CAPACITY, items);
}

export function getPcItems(bytes: Uint8Array): ItemStack[] {
  return getItemList(bytes, OFFSETS.pcItemCount, PC_ITEM_CAPACITY);
}

export function setPcItems(bytes: Uint8Array, items: ItemStack[]): void {
  setItemList(bytes, OFFSETS.pcItemCount, PC_ITEM_CAPACITY, items);
}

// --- Party ------------------------------------------------------------------------------

export interface MonSlot {
  mon: MonRecord;
  nickname: string;
  otName: string;
}

export function getParty(bytes: Uint8Array): MonSlot[] {
  const count = Math.min(bytes[OFFSETS.partyCount], PARTY_LENGTH);
  const slots: MonSlot[] = [];
  for (let i = 0; i < count; i++) {
    slots.push({
      mon: readMon(bytes, OFFSETS.partyMons + i * PARTY_MON_SIZE, true),
      otName: decodeName(bytes.subarray(OFFSETS.partyMonOts + i * NAME_LENGTH, OFFSETS.partyMonOts + (i + 1) * NAME_LENGTH)),
      nickname: decodeName(
        bytes.subarray(OFFSETS.partyMonNicks + i * NAME_LENGTH, OFFSETS.partyMonNicks + (i + 1) * NAME_LENGTH),
      ),
    });
  }
  return slots;
}

export interface MonNames {
  nickname: string;
  otName: string;
}

/** Write (or append at `slot === count`) a party member, keeping count/species list in sync. */
export function setPartyMon(bytes: Uint8Array, slot: number, mon: MonRecord, names: MonNames): void {
  const count = Math.min(bytes[OFFSETS.partyCount], PARTY_LENGTH);
  if (slot < 0 || slot > count || slot >= PARTY_LENGTH) {
    throw new RangeError(`Invalid party slot ${slot} for party of ${count}`);
  }
  writeMon(bytes, OFFSETS.partyMons + slot * PARTY_MON_SIZE, mon, true);
  bytes.set(encodeText(names.otName, NAME_LENGTH), OFFSETS.partyMonOts + slot * NAME_LENGTH);
  bytes.set(encodeText(names.nickname, NAME_LENGTH), OFFSETS.partyMonNicks + slot * NAME_LENGTH);
  const newCount = Math.max(count, slot + 1);
  bytes[OFFSETS.partyCount] = newCount;
  bytes[OFFSETS.partySpecies + slot] = mon.species;
  bytes[OFFSETS.partySpecies + newCount] = 0xff;
}

/** Remove a party member and compact the remaining slots. */
export function removePartyMon(bytes: Uint8Array, slot: number): void {
  const count = Math.min(bytes[OFFSETS.partyCount], PARTY_LENGTH);
  if (slot < 0 || slot >= count) throw new RangeError(`Invalid party slot ${slot} for party of ${count}`);
  for (let i = slot; i < count - 1; i++) {
    bytes.copyWithin(
      OFFSETS.partyMons + i * PARTY_MON_SIZE,
      OFFSETS.partyMons + (i + 1) * PARTY_MON_SIZE,
      OFFSETS.partyMons + (i + 2) * PARTY_MON_SIZE,
    );
    bytes.copyWithin(
      OFFSETS.partyMonOts + i * NAME_LENGTH,
      OFFSETS.partyMonOts + (i + 1) * NAME_LENGTH,
      OFFSETS.partyMonOts + (i + 2) * NAME_LENGTH,
    );
    bytes.copyWithin(
      OFFSETS.partyMonNicks + i * NAME_LENGTH,
      OFFSETS.partyMonNicks + (i + 1) * NAME_LENGTH,
      OFFSETS.partyMonNicks + (i + 2) * NAME_LENGTH,
    );
    bytes[OFFSETS.partySpecies + i] = bytes[OFFSETS.partySpecies + i + 1];
  }
  const newCount = count - 1;
  bytes[OFFSETS.partyCount] = newCount;
  bytes[OFFSETS.partySpecies + newCount] = 0xff;
}

/** Move a party member from one slot to another, keeping records/species/names aligned. */
export function reorderParty(bytes: Uint8Array, from: number, to: number): void {
  const count = Math.min(bytes[OFFSETS.partyCount], PARTY_LENGTH);
  if (from < 0 || from >= count || to < 0 || to >= count || from === to) return;

  const order = moveInArray(
    Array.from({ length: count }, (_, i) => i),
    from,
    to,
  );
  const mons = order.map((i) => bytes.slice(OFFSETS.partyMons + i * PARTY_MON_SIZE, OFFSETS.partyMons + (i + 1) * PARTY_MON_SIZE));
  const ots = order.map((i) => bytes.slice(OFFSETS.partyMonOts + i * NAME_LENGTH, OFFSETS.partyMonOts + (i + 1) * NAME_LENGTH));
  const nicks = order.map((i) => bytes.slice(OFFSETS.partyMonNicks + i * NAME_LENGTH, OFFSETS.partyMonNicks + (i + 1) * NAME_LENGTH));
  const species = order.map((i) => bytes[OFFSETS.partySpecies + i]);

  mons.forEach((rec, i) => bytes.set(rec, OFFSETS.partyMons + i * PARTY_MON_SIZE));
  ots.forEach((rec, i) => bytes.set(rec, OFFSETS.partyMonOts + i * NAME_LENGTH));
  nicks.forEach((rec, i) => bytes.set(rec, OFFSETS.partyMonNicks + i * NAME_LENGTH));
  species.forEach((sp, i) => (bytes[OFFSETS.partySpecies + i] = sp));
}

// --- Boxes -----------------------------------------------------------------------------------

const BOX = {
  count: 0,
  species: 1,
  mons: 1 + (MONS_PER_BOX + 1),
  ots: 1 + (MONS_PER_BOX + 1) + MONS_PER_BOX * BOX_MON_SIZE,
  nicks: 1 + (MONS_PER_BOX + 1) + MONS_PER_BOX * BOX_MON_SIZE + MONS_PER_BOX * NAME_LENGTH,
} as const;

export function getCurrentBoxIndex(bytes: Uint8Array): number {
  return bytes[OFFSETS.currentBoxNum] & 0x7f;
}

export interface BoxContents {
  mons: MonSlot[];
  capacity: number;
}

/**
 * The current box lives in the bank-1 cache (`sCurBoxData`), which is what the
 * game loads on continue; the stored slot in bank 2/3 may be stale. Reads of
 * the current box therefore use the cache, and writes go to both locations to
 * keep them consistent.
 */
function boxBases(bytes: Uint8Array, boxIndex: number): number[] {
  if (boxIndex < 0 || boxIndex >= NUM_BOXES) throw new RangeError(`Invalid box index: ${boxIndex}`);
  const stored = storedBoxOffset(boxIndex);
  if (getCurrentBoxIndex(bytes) === boxIndex) return [OFFSETS.currentBox, stored];
  return [stored];
}

export function readBox(bytes: Uint8Array, boxIndex: number): BoxContents {
  const base = boxBases(bytes, boxIndex)[0];
  const count = Math.min(bytes[base + BOX.count], MONS_PER_BOX);
  const mons: MonSlot[] = [];
  for (let i = 0; i < count; i++) {
    mons.push({
      mon: readMon(bytes, base + BOX.mons + i * BOX_MON_SIZE, false),
      otName: decodeName(bytes.subarray(base + BOX.ots + i * NAME_LENGTH, base + BOX.ots + (i + 1) * NAME_LENGTH)),
      nickname: decodeName(
        bytes.subarray(base + BOX.nicks + i * NAME_LENGTH, base + BOX.nicks + (i + 1) * NAME_LENGTH),
      ),
    });
  }
  return { mons, capacity: MONS_PER_BOX };
}

export function writeBoxMon(bytes: Uint8Array, boxIndex: number, slot: number, mon: MonRecord, names: MonNames): void {
  for (const base of boxBases(bytes, boxIndex)) {
    const count = Math.min(bytes[base + BOX.count], MONS_PER_BOX);
    if (slot < 0 || slot > count || slot >= MONS_PER_BOX) {
      throw new RangeError(`Invalid box slot ${slot} for box of ${count}`);
    }
    writeMon(bytes, base + BOX.mons + slot * BOX_MON_SIZE, mon, false);
    bytes.set(encodeText(names.otName, NAME_LENGTH), base + BOX.ots + slot * NAME_LENGTH);
    bytes.set(encodeText(names.nickname, NAME_LENGTH), base + BOX.nicks + slot * NAME_LENGTH);
    const newCount = Math.max(count, slot + 1);
    bytes[base + BOX.count] = newCount;
    bytes[base + BOX.species + slot] = mon.species;
    bytes[base + BOX.species + newCount] = 0xff;
  }
}

export function removeBoxMon(bytes: Uint8Array, boxIndex: number, slot: number): void {
  for (const base of boxBases(bytes, boxIndex)) {
    const count = Math.min(bytes[base + BOX.count], MONS_PER_BOX);
    if (slot < 0 || slot >= count) throw new RangeError(`Invalid box slot ${slot} for box of ${count}`);
    for (let i = slot; i < count - 1; i++) {
      bytes.copyWithin(
        base + BOX.mons + i * BOX_MON_SIZE,
        base + BOX.mons + (i + 1) * BOX_MON_SIZE,
        base + BOX.mons + (i + 2) * BOX_MON_SIZE,
      );
      bytes.copyWithin(
        base + BOX.ots + i * NAME_LENGTH,
        base + BOX.ots + (i + 1) * NAME_LENGTH,
        base + BOX.ots + (i + 2) * NAME_LENGTH,
      );
      bytes.copyWithin(
        base + BOX.nicks + i * NAME_LENGTH,
        base + BOX.nicks + (i + 1) * NAME_LENGTH,
        base + BOX.nicks + (i + 2) * NAME_LENGTH,
      );
      bytes[base + BOX.species + i] = bytes[base + BOX.species + i + 1];
    }
    const newCount = count - 1;
    bytes[base + BOX.count] = newCount;
    bytes[base + BOX.species + newCount] = 0xff;
  }
}

/** Move a stored Pokémon within a box, keeping records/species/names aligned. */
export function reorderBoxMon(bytes: Uint8Array, boxIndex: number, from: number, to: number): void {
  for (const base of boxBases(bytes, boxIndex)) {
    const count = Math.min(bytes[base + BOX.count], MONS_PER_BOX);
    if (from < 0 || from >= count || to < 0 || to >= count || from === to) continue;
    const order = moveInArray(Array.from({ length: count }, (_, i) => i), from, to);
    const mons = order.map((i) => bytes.slice(base + BOX.mons + i * BOX_MON_SIZE, base + BOX.mons + (i + 1) * BOX_MON_SIZE));
    const ots = order.map((i) => bytes.slice(base + BOX.ots + i * NAME_LENGTH, base + BOX.ots + (i + 1) * NAME_LENGTH));
    const nicks = order.map((i) => bytes.slice(base + BOX.nicks + i * NAME_LENGTH, base + BOX.nicks + (i + 1) * NAME_LENGTH));
    const species = order.map((i) => bytes[base + BOX.species + i]);
    mons.forEach((rec, i) => bytes.set(rec, base + BOX.mons + i * BOX_MON_SIZE));
    ots.forEach((rec, i) => bytes.set(rec, base + BOX.ots + i * NAME_LENGTH));
    nicks.forEach((rec, i) => bytes.set(rec, base + BOX.nicks + i * NAME_LENGTH));
    species.forEach((sp, i) => (bytes[base + BOX.species + i] = sp));
  }
}

// --- Day care -------------------------------------------------------------------------------

export interface DayCare {
  inUse: boolean;
  mon?: MonSlot;
}

export function getDayCare(bytes: Uint8Array): DayCare {
  const inUse = bytes[OFFSETS.dayCareInUse] !== 0;
  if (!inUse) return { inUse };
  return {
    inUse,
    mon: {
      mon: readMon(bytes, OFFSETS.dayCareMon, false),
      nickname: decodeName(bytes.subarray(OFFSETS.dayCareMonName, OFFSETS.dayCareMonName + NAME_LENGTH)),
      otName: decodeName(bytes.subarray(OFFSETS.dayCareMonOt, OFFSETS.dayCareMonOt + NAME_LENGTH)),
    },
  };
}
