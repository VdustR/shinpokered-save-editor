import { describe, expect, it } from "vitest";
import { decodeName, decodeText, encodeText, isEncodable } from "./text";

// Verified against shinpokered charmap.asm: "A"=$80, "a"=$a0, "0"=$f6,
// "@"=$50 (terminator), " "=$7f, "é"=$ba, "♂"=$ef, "♀"=$f5.
const A = 0x80;
const TERM = 0x50;

describe("decodeText", () => {
  it("decodes uppercase letters up to the terminator", () => {
    const bytes = new Uint8Array([0x91, 0x84, 0x83, TERM, 0xaa, 0xbb]); // "RED@"
    expect(decodeText(bytes)).toBe("RED");
  });

  it("decodes the whole buffer when no terminator exists", () => {
    const bytes = new Uint8Array([A, A + 1]); // "AB"
    expect(decodeText(bytes)).toBe("AB");
  });

  it("decodes digits, lowercase, and special glyphs", () => {
    // "Nido♂ é0"
    const bytes = new Uint8Array([0x8d, 0xa8, 0xa3, 0xae, 0xef, 0x7f, 0xba, 0xf6, TERM]);
    expect(decodeText(bytes)).toBe("Nido♂ é0");
  });

  it("renders unknown bytes as hex placeholders", () => {
    const bytes = new Uint8Array([A, 0x01, TERM]);
    expect(decodeText(bytes)).toBe("A<$01>");
  });
});

describe("encodeText", () => {
  it("encodes into a fixed-length field padded with terminators", () => {
    expect(Array.from(encodeText("RED", 11))).toEqual([
      0x91, 0x84, 0x83, TERM, TERM, TERM, TERM, TERM, TERM, TERM, TERM,
    ]);
  });

  it("prefers longest-match tokens over single characters", () => {
    // "<pkmn>" ($4a) and "'s" ($bd) style multi-char tokens must match greedily.
    const encoded = encodeText("<pkmn>'s", 11);
    expect(Array.from(encoded.slice(0, 3))).toEqual([0x4a, 0xbd, 0x50]);
    expect(decodeText(encoded)).toBe("<pkmn>'s");
  });

  it("round-trips every encodable name", () => {
    for (const name of ["RED", "Blue9", "MR.MIME", "♀é♂", "A B"]) {
      expect(decodeText(encodeText(name, 11))).toBe(name);
    }
  });

  it("throws on strings that exceed the field (terminator needs a slot)", () => {
    expect(() => encodeText("ABCDEFGHIJK", 11)).toThrow(/too long/i);
    expect(() => encodeText("ABCDEFGHIJ", 11)).not.toThrow();
  });

  it("throws on characters outside the charmap", () => {
    expect(() => encodeText("中文", 11)).toThrow(/cannot encode/i);
  });
});

describe("decodeName", () => {
  it("stops at the 0x50 terminator like decodeText", () => {
    const bytes = new Uint8Array([0x91, 0x84, 0x83, TERM, 0x84]);
    expect(decodeName(bytes)).toBe("RED");
  });

  it("treats a 0x00 field as empty instead of rendering <$00>", () => {
    const bytes = new Uint8Array(11).fill(0x00);
    expect(decodeText(bytes)).toContain("<$00>");
    expect(decodeName(bytes)).toBe("");
  });

  it("stops at the first 0x00 mid-field", () => {
    const bytes = new Uint8Array([A, A + 1, 0x00, A + 2]);
    expect(decodeName(bytes)).toBe("AB");
  });
});

describe("isEncodable", () => {
  it("accepts game-encodable strings and rejects others", () => {
    expect(isEncodable("RED")).toBe(true);
    expect(isEncodable("中文")).toBe(false);
  });
});
