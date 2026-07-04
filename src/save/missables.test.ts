import { describe, expect, it } from "vitest";
import { SAVE_SIZE } from "./layout";
import { MISSABLE_BALLS, MISSABLES_OFFSET, ballLabel, getMissable, setMissable } from "./missables";

describe("missable item balls", () => {
  it("maps to wMissableObjectFlags (d5a6 -> 0x2852)", () => {
    expect(MISSABLES_OFFSET).toBe(0x2852);
  });

  it("exposes the 104 item balls with items joined from map objects", () => {
    expect(MISSABLE_BALLS.length).toBe(104);
    // HS_ROUTE_2_ITEM_1 is bit 25 and holds a Moon Stone.
    const first = MISSABLE_BALLS.find((b) => b.index === 25);
    expect(first?.map).toBe("ROUTE_2");
    expect(ballLabel(first!)).toBe("Route 2 — MOON STONE");
    // Every ball resolved an item.
    expect(MISSABLE_BALLS.every((b) => b.item !== null)).toBe(true);
  });

  it("reads and writes bits by HS index without touching neighbours", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    setMissable(bytes, 25, true); // byte 3, bit 1
    expect(getMissable(bytes, 25)).toBe(true);
    expect(bytes[0x2852 + 3]).toBe(0b0000_0010);
    setMissable(bytes, 25, false);
    expect(bytes[0x2852 + 3]).toBe(0);
  });
});
