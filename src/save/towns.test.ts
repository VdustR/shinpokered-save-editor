import { describe, expect, it } from "vitest";
import { SAVE_SIZE } from "./layout";
import { TOWNS, TOWNS_VISITED_OFFSET, getTownVisited, setTownVisited } from "./towns";

describe("visited towns (wTownVisitedFlag)", () => {
  it("maps to file offset 0x29b7 (d70b) and lists the 11 Gen 1 towns in map order", () => {
    expect(TOWNS_VISITED_OFFSET).toBe(0x29b7);
    expect(TOWNS).toHaveLength(11);
    expect(TOWNS[0].name).toBe("Pallet Town");
    expect(TOWNS[9].name).toBe("Indigo Plateau");
    expect(TOWNS[10].name).toBe("Saffron City");
  });

  it("reads and writes town bits by map id", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    // Pallet Town = map 0 -> byte 0 bit 0; Saffron = map 10 -> byte 1 bit 2.
    setTownVisited(bytes, 0, true);
    setTownVisited(bytes, 10, true);
    expect(getTownVisited(bytes, 0)).toBe(true);
    expect(getTownVisited(bytes, 10)).toBe(true);
    expect(bytes[0x29b7]).toBe(0b0000_0001);
    expect(bytes[0x29b8]).toBe(0b0000_0100);
    setTownVisited(bytes, 10, false);
    expect(bytes[0x29b8]).toBe(0);
  });

  it("leaves unrelated bits alone", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    bytes[0x29b7] = 0b1111_0000;
    setTownVisited(bytes, 1, true);
    expect(bytes[0x29b7]).toBe(0b1111_0010);
  });
});
