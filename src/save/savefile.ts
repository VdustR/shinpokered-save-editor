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
  BOX_DATA_SIZE,
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

/**
 * The rival's full teams live in ROM trainer-party data, but which of the
 * three team variants he brings to every battle is selected from the starter
 * he took, stored in the save (wRivalStarter d715; see scripts/gary.asm).
 * wPlayerStarter (d717) records the player's pick and drives some dialogue.
 * Values are species internal ids; anything other than the three starters
 * falls through to the first team variant in the game's selection code.
 */
export const RIVAL_STARTER_OFFSET = 0x25a3 + (0xd715 - 0xd2f7); // 0x29c1
export const PLAYER_STARTER_OFFSET = 0x25a3 + (0xd717 - 0xd2f7); // 0x29c3

export function getRivalStarter(bytes: Uint8Array): number {
  return bytes[RIVAL_STARTER_OFFSET];
}

export function setRivalStarter(bytes: Uint8Array, species: number): void {
  bytes[RIVAL_STARTER_OFFSET] = species & 0xff;
}

export function getPlayerStarter(bytes: Uint8Array): number {
  return bytes[PLAYER_STARTER_OFFSET];
}

export function setPlayerStarter(bytes: Uint8Array, species: number): void {
  bytes[PLAYER_STARTER_OFFSET] = species & 0xff;
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
  /** False when the game has never written this box (raw SRAM fill). */
  initialized: boolean;
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

/**
 * The game only writes a stored box when the player switches boxes in-game,
 * so never-used boxes still hold raw SRAM fill (0xff everywhere). A count
 * byte above MONS_PER_BOX is that signature; treat the box as empty instead
 * of rendering 20 phantom level-255 entries.
 */
function isBoxInitialized(bytes: Uint8Array, base: number): boolean {
  return bytes[base + BOX.count] <= MONS_PER_BOX;
}

/** Reset a box block to a valid empty state (count 0, terminated species list). */
function initializeBox(bytes: Uint8Array, base: number): void {
  bytes.fill(0, base, base + BOX_DATA_SIZE);
  bytes[base + BOX.species] = 0xff;
}

export function readBox(bytes: Uint8Array, boxIndex: number): BoxContents {
  const base = boxBases(bytes, boxIndex)[0];
  if (!isBoxInitialized(bytes, base)) {
    return { mons: [], capacity: MONS_PER_BOX, initialized: false };
  }
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
  return { mons, capacity: MONS_PER_BOX, initialized: true };
}

export function writeBoxMon(bytes: Uint8Array, boxIndex: number, slot: number, mon: MonRecord, names: MonNames): void {
  const bases = boxBases(bytes, boxIndex);
  const primary = bases[0];
  for (const base of bases) {
    if (!isBoxInitialized(bytes, base)) {
      // For the current box the stored mirror can be raw fill while the
      // cache holds mons; seed it from the primary copy so slot indexes stay
      // valid, and only fall back to an empty box when nothing exists yet.
      if (base !== primary && isBoxInitialized(bytes, primary)) {
        bytes.copyWithin(base, primary, primary + BOX_DATA_SIZE);
      } else {
        initializeBox(bytes, base);
      }
    }
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
    if (!isBoxInitialized(bytes, base)) continue; // nothing real to remove
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
  const bases = boxBases(bytes, boxIndex);
  const primary = bases[0]; // the bank-1 cache for the current box, else storage
  if (!isBoxInitialized(bytes, primary)) return; // phantom entries, nothing to reorder
  const count = Math.min(bytes[primary + BOX.count], MONS_PER_BOX);
  if (from < 0 || from >= count || to < 0 || to >= count || from === to) return;

  const order = moveInArray(Array.from({ length: count }, (_, i) => i), from, to);
  const mons = order.map((i) => bytes.slice(primary + BOX.mons + i * BOX_MON_SIZE, primary + BOX.mons + (i + 1) * BOX_MON_SIZE));
  const ots = order.map((i) => bytes.slice(primary + BOX.ots + i * NAME_LENGTH, primary + BOX.ots + (i + 1) * NAME_LENGTH));
  const nicks = order.map((i) => bytes.slice(primary + BOX.nicks + i * NAME_LENGTH, primary + BOX.nicks + (i + 1) * NAME_LENGTH));
  const species = order.map((i) => bytes[primary + BOX.species + i]);
  mons.forEach((rec, i) => bytes.set(rec, primary + BOX.mons + i * BOX_MON_SIZE));
  ots.forEach((rec, i) => bytes.set(rec, primary + BOX.ots + i * NAME_LENGTH));
  nicks.forEach((rec, i) => bytes.set(rec, primary + BOX.nicks + i * NAME_LENGTH));
  species.forEach((sp, i) => (bytes[primary + BOX.species + i] = sp));

  // Mirror the reordered box wholesale to the other location (the stored slot
  // for the current box) so the cache and storage stay identical, even if the
  // stored copy was stale before the reorder.
  for (const other of bases.slice(1)) bytes.copyWithin(other, primary, primary + BOX_DATA_SIZE);
}

// --- Day care -------------------------------------------------------------------------------

export interface DayCare {
  inUse: boolean;
  mon?: MonSlot;
}

/** Board a mon at the day care: sets the in-use byte, box record, and names. */
export function setDayCareMon(bytes: Uint8Array, mon: MonRecord, names: MonNames): void {
  bytes[OFFSETS.dayCareInUse] = 1;
  writeMon(bytes, OFFSETS.dayCareMon, mon, false);
  bytes.set(encodeText(names.nickname, NAME_LENGTH), OFFSETS.dayCareMonName);
  bytes.set(encodeText(names.otName, NAME_LENGTH), OFFSETS.dayCareMonOt);
}

/** Empty the day care: clear the in-use byte and wipe the record and names. */
export function clearDayCare(bytes: Uint8Array): void {
  bytes[OFFSETS.dayCareInUse] = 0;
  bytes.fill(0, OFFSETS.dayCareMonName, OFFSETS.dayCareMonName + NAME_LENGTH * 2); // name + OT
  bytes.fill(0, OFFSETS.dayCareMon, OFFSETS.dayCareMon + BOX_MON_SIZE);
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
