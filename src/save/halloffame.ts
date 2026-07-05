/**
 * Hall of Fame records live in SRAM bank 0 (sHallOfFame, file 0x0598) with no
 * checksum. Layout from engine/hall_of_fame.asm and misc_constants.asm:
 * each mon is HOF_MON (16) bytes — species, level, nickname (11), padding —
 * six mons per team (HOF_TEAM = 96), up to 50 stored teams. A team with fewer
 * than six mons ends with a 0xff species byte. wNumHoFTeams (d5a2 -> 0x284e)
 * counts championship wins and keeps counting past the storage cap.
 */
import { NAME_LENGTH } from "./layout";
import { decodeName } from "./text";

export const HOF_OFFSET = 0x0598;
export const HOF_MON_SIZE = 16;
export const HOF_TEAM_SIZE = 96;
export const HOF_CAPACITY = 50;
export const HOF_COUNT_OFFSET = 0x25a3 + (0xd5a2 - 0xd2f7); // 0x284e

export interface HofMon {
  species: number;
  level: number;
  nickname: string;
}

export function getHofCount(bytes: Uint8Array): number {
  return bytes[HOF_COUNT_OFFSET];
}

export function setHofCount(bytes: Uint8Array, count: number): void {
  bytes[HOF_COUNT_OFFSET] = Math.min(Math.max(Math.trunc(count), 0), 0xff);
}

export function readHofTeams(bytes: Uint8Array): HofMon[][] {
  const teams: HofMon[][] = [];
  const stored = Math.min(getHofCount(bytes), HOF_CAPACITY);
  for (let t = 0; t < stored; t++) {
    const team: HofMon[] = [];
    for (let s = 0; s < 6; s++) {
      const off = HOF_OFFSET + t * HOF_TEAM_SIZE + s * HOF_MON_SIZE;
      const species = bytes[off];
      if (species === 0xff || species === 0x00) break;
      team.push({
        species,
        level: bytes[off + 1],
        nickname: decodeName(bytes.subarray(off + 2, off + 2 + NAME_LENGTH)),
      });
    }
    teams.push(team);
  }
  return teams;
}

/** Zero the whole record region and the win counter. */
export function clearHallOfFame(bytes: Uint8Array): void {
  bytes.fill(0, HOF_OFFSET, HOF_OFFSET + HOF_TEAM_SIZE * HOF_CAPACITY);
  bytes[HOF_COUNT_OFFSET] = 0;
}
