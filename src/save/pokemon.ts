/**
 * Gen 1 Pokémon record codec. Layout from shinpokered `wram.asm`:
 * box_struct (33 bytes) plus party-only level + 5 computed stats (44 bytes).
 */
import { BOX_MON_SIZE, PARTY_MON_SIZE } from "./layout";

export interface StatExp {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  spc: number;
}

export interface Dvs {
  atk: number;
  def: number;
  spd: number;
  spc: number;
}

export interface ComputedStats {
  atk: number;
  def: number;
  spd: number;
  spc: number;
}

export interface MonRecord {
  species: number;
  currentHp: number;
  boxLevel: number;
  status: number;
  types: [number, number];
  catchRate: number;
  moves: [number, number, number, number];
  otId: number;
  exp: number;
  statExp: StatExp;
  dvs: Dvs;
  pp: [number, number, number, number];
  /** Party records store the authoritative level at +0x21; box records fall back to boxLevel. */
  level: number;
  maxHp?: number;
  stats?: ComputedStats;
}

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function writeU16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

/** HP DV is derived from the LSBs of the other four DVs. */
export function getDvs(byte0: number, byte1: number): Dvs & { hp: number } {
  const atk = byte0 >> 4;
  const def = byte0 & 0x0f;
  const spd = byte1 >> 4;
  const spc = byte1 & 0x0f;
  const hp = ((atk & 1) << 3) | ((def & 1) << 2) | ((spd & 1) << 1) | (spc & 1);
  return { atk, def, spd, spc, hp };
}

export function packDvs(dvs: Dvs): [number, number] {
  return [((dvs.atk & 0x0f) << 4) | (dvs.def & 0x0f), ((dvs.spd & 0x0f) << 4) | (dvs.spc & 0x0f)];
}

export function hpDvOf(dvs: Dvs): number {
  return ((dvs.atk & 1) << 3) | ((dvs.def & 1) << 2) | ((dvs.spd & 1) << 1) | (dvs.spc & 1);
}

export function readMon(bytes: Uint8Array, offset: number, isParty: boolean): MonRecord {
  const b = bytes.subarray(offset, offset + (isParty ? PARTY_MON_SIZE : BOX_MON_SIZE));
  const dvs = getDvs(b[0x1b], b[0x1c]);
  const mon: MonRecord = {
    species: b[0x00],
    currentHp: readU16(b, 0x01),
    boxLevel: b[0x03],
    status: b[0x04],
    types: [b[0x05], b[0x06]],
    catchRate: b[0x07],
    moves: [b[0x08], b[0x09], b[0x0a], b[0x0b]],
    otId: readU16(b, 0x0c),
    exp: (b[0x0e] << 16) | (b[0x0f] << 8) | b[0x10],
    statExp: {
      hp: readU16(b, 0x11),
      atk: readU16(b, 0x13),
      def: readU16(b, 0x15),
      spd: readU16(b, 0x17),
      spc: readU16(b, 0x19),
    },
    dvs: { atk: dvs.atk, def: dvs.def, spd: dvs.spd, spc: dvs.spc },
    pp: [b[0x1d], b[0x1e], b[0x1f], b[0x20]],
    level: isParty ? b[0x21] : b[0x03],
  };
  if (isParty) {
    mon.maxHp = readU16(b, 0x22);
    mon.stats = {
      atk: readU16(b, 0x24),
      def: readU16(b, 0x26),
      spd: readU16(b, 0x28),
      spc: readU16(b, 0x2a),
    };
  }
  return mon;
}

export function writeMon(bytes: Uint8Array, offset: number, mon: MonRecord, isParty: boolean): void {
  const b = bytes.subarray(offset, offset + (isParty ? PARTY_MON_SIZE : BOX_MON_SIZE));
  b[0x00] = mon.species;
  writeU16(b, 0x01, mon.currentHp);
  b[0x03] = isParty ? mon.boxLevel : mon.level;
  b[0x04] = mon.status;
  b[0x05] = mon.types[0];
  b[0x06] = mon.types[1];
  b[0x07] = mon.catchRate;
  for (let i = 0; i < 4; i++) b[0x08 + i] = mon.moves[i];
  writeU16(b, 0x0c, mon.otId);
  b[0x0e] = (mon.exp >> 16) & 0xff;
  b[0x0f] = (mon.exp >> 8) & 0xff;
  b[0x10] = mon.exp & 0xff;
  writeU16(b, 0x11, mon.statExp.hp);
  writeU16(b, 0x13, mon.statExp.atk);
  writeU16(b, 0x15, mon.statExp.def);
  writeU16(b, 0x17, mon.statExp.spd);
  writeU16(b, 0x19, mon.statExp.spc);
  const [dv0, dv1] = packDvs(mon.dvs);
  b[0x1b] = dv0;
  b[0x1c] = dv1;
  for (let i = 0; i < 4; i++) b[0x1d + i] = mon.pp[i];
  if (isParty) {
    b[0x21] = mon.level;
    writeU16(b, 0x22, mon.maxHp ?? 0);
    writeU16(b, 0x24, mon.stats?.atk ?? 0);
    writeU16(b, 0x26, mon.stats?.def ?? 0);
    writeU16(b, 0x28, mon.stats?.spd ?? 0);
    writeU16(b, 0x2a, mon.stats?.spc ?? 0);
  }
}
