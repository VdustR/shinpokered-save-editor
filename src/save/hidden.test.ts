import { describe, expect, it } from "vitest";
import { SAVE_SIZE } from "./layout";
import {
  HIDDEN_COINS,
  HIDDEN_COINS_OFFSET,
  HIDDEN_ITEMS,
  HIDDEN_ITEMS_OFFSET,
  getHiddenFlag,
  hiddenSpotLabel,
  setHiddenFlag,
} from "./hidden";

describe("hidden item/coin flags", () => {
  it("maps to wObtainedHiddenItemsFlags (d6f0 -> 0x299c) and coins (d6fe -> 0x29aa)", () => {
    expect(HIDDEN_ITEMS_OFFSET).toBe(0x299c);
    expect(HIDDEN_COINS_OFFSET).toBe(0x29aa);
  });

  it("exposes the generated spot lists with item names joined from the source", () => {
    expect(HIDDEN_ITEMS.length).toBeGreaterThanOrEqual(60);
    expect(HIDDEN_COINS.length).toBeGreaterThanOrEqual(10);
    // First row of HiddenItemCoords: Viridian Forest potion.
    expect(HIDDEN_ITEMS[0].map).toBe("VIRIDIAN_FOREST");
    expect(hiddenSpotLabel(HIDDEN_ITEMS[0])).toBe("Viridian Forest — POTION (1, 18)");
    // Coins have no item id; callers supply the fallback word.
    expect(hiddenSpotLabel(HIDDEN_COINS[0], "coins")).toMatch(/^Game Corner — coins /);
    expect(hiddenSpotLabel({ map: "ROUTE_1", x: 1, y: 2, item: null })).toBe("Route 1 — ? (1, 2)");
  });

  it("reads and writes bits by row index without touching neighbours", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    setHiddenFlag(bytes, HIDDEN_ITEMS_OFFSET, 0, true); // bit 0 -> byte 0
    setHiddenFlag(bytes, HIDDEN_ITEMS_OFFSET, 9, true); // bit 9 -> byte 1 bit 1
    expect(getHiddenFlag(bytes, HIDDEN_ITEMS_OFFSET, 0)).toBe(true);
    expect(getHiddenFlag(bytes, HIDDEN_ITEMS_OFFSET, 9)).toBe(true);
    expect(bytes[0x299c]).toBe(0b0000_0001);
    expect(bytes[0x299d]).toBe(0b0000_0010);
    setHiddenFlag(bytes, HIDDEN_ITEMS_OFFSET, 9, false);
    expect(bytes[0x299d]).toBe(0);
  });
});
