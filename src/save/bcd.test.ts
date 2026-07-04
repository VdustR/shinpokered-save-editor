import { describe, expect, it } from "vitest";
import { decodeBcd, encodeBcd } from "./bcd";

describe("decodeBcd", () => {
  it("decodes big-endian packed BCD", () => {
    expect(decodeBcd(new Uint8Array([0x01, 0x23, 0x45]))).toBe(12345);
    expect(decodeBcd(new Uint8Array([0x00, 0x00, 0x00]))).toBe(0);
    expect(decodeBcd(new Uint8Array([0x99, 0x99, 0x99]))).toBe(999999);
  });

  it("treats invalid nibbles (a-f) as their numeric value so decoding never throws", () => {
    // Corrupt saves can contain non-BCD nibbles; 0xf9 -> 15*10 + 9 = "159" digit-pair value.
    expect(decodeBcd(new Uint8Array([0xf9]))).toBe(15 * 10 + 9);
  });
});

describe("encodeBcd", () => {
  it("encodes into fixed-width big-endian packed BCD", () => {
    expect(Array.from(encodeBcd(12345, 3))).toEqual([0x01, 0x23, 0x45]);
    expect(Array.from(encodeBcd(0, 3))).toEqual([0x00, 0x00, 0x00]);
    expect(Array.from(encodeBcd(50, 2))).toEqual([0x00, 0x50]);
  });

  it("clamps to the maximum representable value", () => {
    expect(Array.from(encodeBcd(1_000_000, 3))).toEqual([0x99, 0x99, 0x99]);
    expect(Array.from(encodeBcd(-5, 3))).toEqual([0x00, 0x00, 0x00]);
  });
});
