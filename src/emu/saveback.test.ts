import { describe, expect, it } from "vitest";
import { mainSaveRegionChanged } from "./saveback";

describe("mainSaveRegionChanged", () => {
  it("ignores sprite-scratch writes in bank 0", () => {
    const a = new Uint8Array(0x8000);
    const b = Uint8Array.from(a);
    b[0x0000] = 0xaa; // sSpriteBuffer0
    b[0x1fff] = 0xbb; // end of bank 0
    b[0x4000] = 0xcc; // stored box banks are not "the game saved" either
    expect(mainSaveRegionChanged(a, b)).toBe(false);
  });

  it("detects changes across the bank-1 main region boundaries", () => {
    const a = new Uint8Array(0x8000);
    for (const offset of [0x2598, 0x2f00, 0x3523]) {
      const b = Uint8Array.from(a);
      b[offset] = 1;
      expect(mainSaveRegionChanged(a, b)).toBe(true);
    }
    const c = Uint8Array.from(a);
    c[0x2597] = 1; // one byte before the region
    expect(mainSaveRegionChanged(a, c)).toBe(false);
  });
});
