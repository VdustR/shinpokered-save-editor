import type { Range } from "./types";

/** Contiguous byte ranges that differ between two equal-length buffers. */
export function diffRanges(a: Uint8Array, b: Uint8Array): Range[] {
  const ranges: Range[] = [];
  let start = -1;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      ranges.push({ start, end: i - 1 });
      start = -1;
    }
  }
  if (start >= 0) ranges.push({ start, end: len - 1 });
  return ranges;
}

/** Total number of differing bytes. */
export function countDirtyBytes(a: Uint8Array, b: Uint8Array): number {
  let count = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) count += 1;
  return count;
}
