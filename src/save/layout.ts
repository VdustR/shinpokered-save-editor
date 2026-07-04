/**
 * Gen 1 / Shin Pokémon Red save layout.
 *
 * Offsets verified against shinpokered@1.25.0 `sram.asm` / `wram.asm` and
 * cross-referenced with Bulbapedia "Save data structure (Generation I)".
 * Main-data fields are WRAM copies: fileOffset = 0x25a3 + (wramAddr - 0xd2f7).
 */

export const SAVE_SIZE = 0x8000;

export const NAME_LENGTH = 11;
export const PARTY_LENGTH = 6;
export const MONS_PER_BOX = 20;
export const NUM_BOXES = 12;
export const BAG_CAPACITY = 20;
export const PC_ITEM_CAPACITY = 50;

export const PARTY_MON_SIZE = 44;
export const BOX_MON_SIZE = 33;

/** wBoxDataEnd - wBoxDataStart: count + species list + mons + OT names + nicknames. */
export const BOX_DATA_SIZE = 1 + (MONS_PER_BOX + 1) + MONS_PER_BOX * BOX_MON_SIZE + MONS_PER_BOX * NAME_LENGTH * 2;

export const OFFSETS = {
  hallOfFame: 0x0598,
  playerName: 0x2598, // sPlayerName
  mainData: 0x25a3, // sMainData <- wPokedexOwned (d2f7)
  pokedexOwned: 0x25a3, // d2f7, 19 bytes
  pokedexSeen: 0x25b6, // d30a, 19 bytes
  bagItemCount: 0x25c9, // d31d
  bagItems: 0x25ca, // d31e
  money: 0x25f3, // d347, 3-byte BCD
  rivalName: 0x25f6, // d34a
  options: 0x2601, // d355
  badges: 0x2602, // d356
  playerId: 0x2605, // d359, big-endian u16
  pcItemCount: 0x27e6, // d53a
  pcItems: 0x27e7, // d53b
  currentBoxNum: 0x284c, // d5a0
  coins: 0x2850, // d5a4, 2-byte BCD
  playTimeHours: 0x2ced, // da41
  playTimeMaxed: 0x2cee, // da42
  playTimeMinutes: 0x2cef, // da43
  playTimeSeconds: 0x2cf0, // da44
  playTimeFrames: 0x2cf1, // da45
  dayCareInUse: 0x2cf4, // da48
  dayCareMonName: 0x2cf5, // da49
  dayCareMonOt: 0x2d00, // da54
  dayCareMon: 0x2d0b, // da5f, box_struct
  partyCount: 0x2f2c, // d163
  partySpecies: 0x2f2d, // d164, PARTY_LENGTH + 1
  partyMons: 0x2f34, // d16b
  partyMonOts: 0x2fb8, // d273
  partyMonNicks: 0x2ffa, // d2b5
  currentBox: 0x30c0, // sCurBoxData
  tilesetType: 0x3522, // sTilesetType
  mainChecksum: 0x3523, // sMainDataCheckSum
  bank2: 0x4000, // sBox1
  bank3: 0x6000, // sBox7
} as const;

/** File offset of stored box `boxIndex` (0-based, 0..11). */
export function storedBoxOffset(boxIndex: number): number {
  if (boxIndex < 0 || boxIndex >= NUM_BOXES) throw new RangeError(`Invalid box index: ${boxIndex}`);
  const bankBase = boxIndex < 6 ? OFFSETS.bank2 : OFFSETS.bank3;
  return bankBase + (boxIndex % 6) * BOX_DATA_SIZE;
}
