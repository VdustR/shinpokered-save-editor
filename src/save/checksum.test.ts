import { describe, expect, it } from "vitest";
import {
  CHECKSUM_GROUPS,
  computeChecksum,
  listChecksumMismatches,
  repairChecksums,
} from "./checksum";
import { SAVE_SIZE } from "./layout";

describe("computeChecksum", () => {
  it("returns 0xff for an all-zero range", () => {
    const bytes = new Uint8Array(16);
    expect(computeChecksum(bytes, 0, 16)).toBe(0xff);
  });

  it("returns the complement of the 8-bit byte sum", () => {
    // 0x01 + 0x02 + 0x03 = 0x06 -> ~0x06 & 0xff = 0xf9
    const bytes = new Uint8Array([1, 2, 3]);
    expect(computeChecksum(bytes, 0, 3)).toBe(0xf9);
  });

  it("wraps the sum at 8 bits like the game code", () => {
    // 0xff + 0xff = 0x1fe -> 0xfe -> ~0xfe & 0xff = 0x01
    const bytes = new Uint8Array([0xff, 0xff]);
    expect(computeChecksum(bytes, 0, 2)).toBe(0x01);
  });

  it("only sums the requested range", () => {
    const bytes = new Uint8Array([0xaa, 1, 2, 3, 0xbb]);
    expect(computeChecksum(bytes, 1, 3)).toBe(0xf9);
  });
});

describe("checksum groups", () => {
  it("covers main data plus both box banks (whole + individual)", () => {
    const ids = CHECKSUM_GROUPS.map((group) => group.id);
    expect(ids).toContain("main");
    expect(ids).toContain("bank2-all");
    expect(ids).toContain("bank3-all");
    expect(ids.filter((id) => id.startsWith("box-"))).toHaveLength(12);
  });

  it("uses the verified offsets from engine/save.asm", () => {
    const main = CHECKSUM_GROUPS.find((group) => group.id === "main")!;
    expect(main.start).toBe(0x2598);
    expect(main.length).toBe(0x3523 - 0x2598);
    expect(main.output).toBe(0x3523);

    const bank2 = CHECKSUM_GROUPS.find((group) => group.id === "bank2-all")!;
    expect(bank2.start).toBe(0x4000);
    expect(bank2.length).toBe(0x462 * 6);
    expect(bank2.output).toBe(0x5a4c);

    const box7 = CHECKSUM_GROUPS.find((group) => group.id === "box-7")!;
    expect(box7.start).toBe(0x6000);
    expect(box7.length).toBe(0x462);
    expect(box7.output).toBe(0x7a4d);
  });
});

describe("repairChecksums / listChecksumMismatches", () => {
  it("makes every group valid and reports repaired groups", () => {
    const bytes = new Uint8Array(SAVE_SIZE).fill(0x5a);
    const repaired = repairChecksums(bytes);
    expect(repaired.length).toBe(CHECKSUM_GROUPS.length);
    expect(listChecksumMismatches(bytes)).toEqual([]);
  });

  it("detects a single corrupted byte in the main group", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    repairChecksums(bytes);
    bytes[0x2600] ^= 0x01;
    expect(listChecksumMismatches(bytes).map((group) => group.id)).toEqual(["main"]);
  });

  it("repairing a checksum-only corruption touches only the checksum byte", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    repairChecksums(bytes);
    bytes[0x5a4c] ^= 0xff; // corrupt the bank2 whole checksum itself
    const before = Uint8Array.from(bytes);
    repairChecksums(bytes);
    const diff: number[] = [];
    bytes.forEach((value, index) => {
      if (value !== before[index]) diff.push(index);
    });
    expect(diff).toEqual([0x5a4c]);
  });
});
