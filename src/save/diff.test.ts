import { describe, expect, it } from "vitest";
import { countDirtyBytes, diffRanges } from "./diff";

describe("diffRanges", () => {
  it("returns nothing for identical buffers", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    expect(diffRanges(a, Uint8Array.from(a))).toEqual([]);
  });

  it("coalesces contiguous differing bytes into ranges", () => {
    const a = new Uint8Array([0, 0, 0, 0, 0, 0]);
    const b = new Uint8Array([0, 9, 9, 0, 9, 0]);
    expect(diffRanges(a, b)).toEqual([
      { start: 1, end: 2 },
      { start: 4, end: 4 },
    ]);
  });

  it("handles a difference at the final byte", () => {
    const a = new Uint8Array([0, 0, 0]);
    const b = new Uint8Array([0, 0, 5]);
    expect(diffRanges(a, b)).toEqual([{ start: 2, end: 2 }]);
  });
});

describe("countDirtyBytes", () => {
  it("counts every differing byte", () => {
    const a = new Uint8Array([0, 0, 0, 0]);
    const b = new Uint8Array([1, 0, 2, 3]);
    expect(countDirtyBytes(a, b)).toBe(3);
  });
});
