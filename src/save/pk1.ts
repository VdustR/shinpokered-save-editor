/**
 * PKHeX-compatible .pk1 import/export.
 *
 * PKHeX stores a single Gen 1 mon as a one-slot international PokeList
 * (PKHeX.Core PokeList1 / PokeCrypto.SIZE_1ULIST = 69 bytes):
 *
 *   u8   count (1)
 *   u8   species mark for slot 0 (internal id; 0xFF = empty)
 *   u8   list terminator (0xFF)
 *   u8[44] party-format mon record
 *   u8[11] OT name
 *   u8[11] nickname
 *
 * The 59-byte Japanese list uses 6-byte names and a different charmap, so
 * it is rejected rather than mis-decoded. Raw 44-byte party and 33-byte box
 * records are accepted as a convenience (no names attached).
 */
import { PARTY_MON_SIZE, BOX_MON_SIZE, NAME_LENGTH } from "./layout";
import { readMon, writeMon, type MonRecord } from "./pokemon";
import type { MonNames } from "./savefile";
import { decodeName, encodeText } from "./text";

export const PK1_SIZE = 69;
const JLIST_SIZE = 59;
const HEADER_SIZE = 3;
const OT_OFFSET = HEADER_SIZE + PARTY_MON_SIZE; // 47
const NICK_OFFSET = OT_OFFSET + NAME_LENGTH; // 58

export interface Pk1 {
  mon: MonRecord;
  names: MonNames;
}

export function exportPk1(mon: MonRecord, names: MonNames): Uint8Array {
  const out = new Uint8Array(PK1_SIZE);
  out[0] = 1;
  out[1] = mon.species === 0 ? 0xff : mon.species;
  out[2] = 0xff;
  writeMon(out, HEADER_SIZE, mon, true);
  out.set(encodeText(names.otName, NAME_LENGTH), OT_OFFSET);
  out.set(encodeText(names.nickname, NAME_LENGTH), NICK_OFFSET);
  return out;
}

/** Parse a .pk1 file; throws with a user-facing message when unusable. */
export function importPk1(data: Uint8Array): Pk1 {
  if (data.length === JLIST_SIZE) {
    throw new Error("This is a Japanese .pk1 (59 bytes); its charmap is not supported.");
  }
  if (data.length === PK1_SIZE) {
    if (data[0] !== 1) throw new Error("Not a single-mon .pk1 file (bad list count).");
    const mon = readMon(data, HEADER_SIZE, true);
    if (mon.species === 0 || data[1] === 0xff) throw new Error("The .pk1 slot is empty.");
    if (data[1] !== mon.species) throw new Error("Corrupt .pk1: header species does not match the record.");
    return {
      mon,
      names: {
        otName: decodeName(data.subarray(OT_OFFSET, OT_OFFSET + NAME_LENGTH)),
        nickname: decodeName(data.subarray(NICK_OFFSET, NICK_OFFSET + NAME_LENGTH)),
      },
    };
  }
  if (data.length === PARTY_MON_SIZE || data.length === BOX_MON_SIZE) {
    const mon = readMon(data, 0, data.length === PARTY_MON_SIZE);
    if (mon.species === 0) throw new Error("The record has no species.");
    return { mon, names: { otName: "TRAINER", nickname: "" } };
  }
  throw new Error(
    `Unrecognized .pk1 size ${data.length}; expected 69 (PKHeX), 44 (party record), or 33 (box record).`,
  );
}
