import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeChecksum } from "./checksum";
import { OFFSETS, SAVE_SIZE } from "./layout";
import { assessSave } from "./validate";

const fixture = () =>
  Uint8Array.from(readFileSync(path.resolve(__dirname, "../../tests/fixtures/newgame.sav")));

describe("assessSave", () => {
  it("accepts a real save written by the game", () => {
    const a = assessSave(fixture());
    expect(a.verdict).toBe("valid");
    expect(a.mainChecksumValid).toBe(true);
    expect(a.issues).toEqual([]);
  });

  it("flags a corrupted-but-plausible save as suspect", () => {
    const bytes = fixture();
    bytes[OFFSETS.money] ^= 0xff; // corrupt one main-data byte -> checksum mismatch
    const a = assessSave(bytes);
    expect(a.verdict).toBe("suspect");
    expect(a.mainChecksumValid).toBe(false);
    expect(a.issues.length).toBeGreaterThan(0);
  });

  it("rejects an all-zero file as invalid", () => {
    const a = assessSave(new Uint8Array(SAVE_SIZE));
    expect(a.verdict).toBe("invalid");
  });

  it("rejects random bytes as invalid", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    // Deterministic pseudo-random fill (no Math.random in tests).
    let seed = 0x12345678;
    for (let i = 0; i < bytes.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      bytes[i] = seed & 0xff;
    }
    const a = assessSave(bytes);
    expect(a.verdict).toBe("invalid");
  });

  it("treats a checksum-valid file as valid even with odd structure", () => {
    // The game itself only checks the main checksum on continue; mirror that.
    const bytes = new Uint8Array(SAVE_SIZE);
    bytes[OFFSETS.partyCount] = 0xaa; // nonsense structure
    bytes[OFFSETS.mainChecksum] = computeChecksum(
      bytes,
      OFFSETS.playerName,
      OFFSETS.mainChecksum - OFFSETS.playerName,
    );
    expect(assessSave(bytes).verdict).toBe("valid");
  });
});
