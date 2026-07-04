/**
 * Gen 1 save checksums, as implemented by `SAVCheckSum` in
 * shinpokered `engine/save.asm`: 8-bit sum of all bytes in the range,
 * complemented.
 */
import { BOX_DATA_SIZE, OFFSETS } from "./layout";

export interface ChecksumGroup {
  id: string;
  label: string;
  start: number;
  length: number;
  output: number;
}

function boxGroups(bankBase: number, firstBox: number): ChecksumGroup[] {
  const allBoxesLength = BOX_DATA_SIZE * 6;
  const bankNum = firstBox === 1 ? 2 : 3;
  const groups: ChecksumGroup[] = [
    {
      id: `bank${bankNum}-all`,
      label: `Boxes ${firstBox}-${firstBox + 5} (whole bank)`,
      start: bankBase,
      length: allBoxesLength,
      output: bankBase + allBoxesLength,
    },
  ];
  for (let i = 0; i < 6; i++) {
    groups.push({
      id: `box-${firstBox + i}`,
      label: `Box ${firstBox + i}`,
      start: bankBase + i * BOX_DATA_SIZE,
      length: BOX_DATA_SIZE,
      output: bankBase + allBoxesLength + 1 + i,
    });
  }
  return groups;
}

export const CHECKSUM_GROUPS: readonly ChecksumGroup[] = [
  {
    id: "main",
    label: "Main data",
    start: OFFSETS.playerName,
    length: OFFSETS.mainChecksum - OFFSETS.playerName,
    output: OFFSETS.mainChecksum,
  },
  ...boxGroups(OFFSETS.bank2, 1),
  ...boxGroups(OFFSETS.bank3, 7),
];

export function computeChecksum(bytes: Uint8Array, start: number, length: number): number {
  let sum = 0;
  for (let i = start; i < start + length; i++) sum = (sum + bytes[i]) & 0xff;
  return ~sum & 0xff;
}

/** Groups whose stored checksum does not match the computed one. */
export function listChecksumMismatches(bytes: Uint8Array): ChecksumGroup[] {
  return CHECKSUM_GROUPS.filter(
    (group) => bytes[group.output] !== computeChecksum(bytes, group.start, group.length),
  );
}

/** Recompute every checksum in place; returns the groups that changed. */
export function repairChecksums(bytes: Uint8Array): ChecksumGroup[] {
  const repaired: ChecksumGroup[] = [];
  for (const group of CHECKSUM_GROUPS) {
    const value = computeChecksum(bytes, group.start, group.length);
    if (bytes[group.output] !== value) {
      bytes[group.output] = value;
      repaired.push(group);
    }
  }
  return repaired;
}

/**
 * Recompute only the checksum groups whose data range changed relative to
 * `original`. A fresh game never initializes the PC box checksum bytes, so
 * blindly repairing all groups would rewrite bytes the game left alone and
 * break byte-for-byte round-trips. Repairing only dirty groups keeps an
 * untouched save identical while still fixing any group the user edited.
 */
export function repairDirtyChecksums(bytes: Uint8Array, original: Uint8Array): ChecksumGroup[] {
  const repaired: ChecksumGroup[] = [];
  for (const group of CHECKSUM_GROUPS) {
    let dirty = false;
    for (let i = group.start; i < group.start + group.length; i++) {
      if (bytes[i] !== original[i]) {
        dirty = true;
        break;
      }
    }
    if (!dirty) continue;
    const value = computeChecksum(bytes, group.start, group.length);
    if (bytes[group.output] !== value) {
      bytes[group.output] = value;
      repaired.push(group);
    }
  }
  return repaired;
}
