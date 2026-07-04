import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportSave, getBadges, getMoney, getParty, getPlayerName, getPlayTime, parseSave } from "./savefile";

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/newgame.sav",
);
const fixture = new Uint8Array(readFileSync(fixturePath));

describe("real emulator fixture (newgame.sav)", () => {
  it("is a 32 KiB save whose main-data checksum the game wrote", () => {
    expect(fixture.length).toBe(0x8000);
    const parsed = parseSave(fixture);
    expect(parsed.warnings).toEqual([]);
    // A fresh game writes the main-data checksum but never initializes the PC
    // box checksums, so the only valid group is "main".
    expect(parsed.checksumMismatches.find((g) => g.id === "main")).toBeUndefined();
    expect(parsed.checksumMismatches.map((g) => g.id)).toContain("box-1");
  });

  it("decodes the trainer created during the scripted playthrough", () => {
    expect(getPlayerName(fixture)).toBe("RED");
    expect(getMoney(fixture)).toBe(3000); // Gen 1 starting money
    expect(getBadges(fixture)).toEqual(new Array(8).fill(false));
    const time = getPlayTime(fixture);
    expect(time.hours).toBe(0);
    expect(time.maxed).toBe(false);
  });

  it("has an empty party at the start of the game", () => {
    expect(getParty(fixture)).toHaveLength(0);
  });

  it("round-trips byte-for-byte with no edits", () => {
    const out = exportSave(fixture, fixture);
    expect(Array.from(out)).toEqual(Array.from(fixture));
  });
});
