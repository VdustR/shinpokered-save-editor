import { describe, expect, it } from "vitest";
import { SAVE_SIZE } from "./layout";
import { MAPS, POSITION_OFFSETS, getPosition, mapName, setPosition } from "./position";

describe("position (wCurMap / wYCoord / wXCoord)", () => {
  it("maps to file offsets 0x260a / 0x260d / 0x260e", () => {
    expect(POSITION_OFFSETS.map).toBe(0x260a);
    expect(POSITION_OFFSETS.y).toBe(0x260d);
    expect(POSITION_OFFSETS.x).toBe(0x260e);
  });

  it("round-trips a warp target", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    setPosition(bytes, { map: 2, x: 10, y: 5 }); // Pewter City
    expect(getPosition(bytes)).toEqual({ map: 2, x: 10, y: 5 });
    expect(bytes[0x260a]).toBe(2);
    expect(bytes[0x260d]).toBe(5);
    expect(bytes[0x260e]).toBe(10);
  });

  it("exposes the 248 generated maps with dimensions and pretty names", () => {
    expect(MAPS).toHaveLength(248);
    expect(MAPS[0].name).toBe("PALLET_TOWN");
    expect(MAPS[0].width).toBe(10);
    expect(MAPS[0].height).toBe(9);
    expect(mapName(0)).toBe("Pallet Town");
    expect(mapName(40)).toMatch(/^[A-Z]/); // any valid id yields a label
    expect(mapName(999)).toBe("Map $3E7");
  });
});
