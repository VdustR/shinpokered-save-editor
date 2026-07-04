import { describe, expect, it } from "vitest";
import {
  SHIN_FLAGS_OFFSET,
  ROM_HACK_VERSION_OFFSET,
  RANDOMIZER_SEED_OFFSET,
  WIN_STREAK_OFFSET,
  getShinFlags,
  getWinStreak,
  setShinFlag,
  setWinStreak,
  genderOf,
  isShinyDvs,
  makeShinyDvs,
} from "./shin";
import { SAVE_SIZE } from "./layout";

// Species internal ids (from generated data): see gamedata.json.
const PIKACHU = 0x54; // 50/50 band: male iff atk DV >= 8
const NIDORAN_M = 0x03; // male-only
const NIDORAN_F = 0x0f; // female-only
const BULBASAUR = 0x99; // 87.5% male band: male iff atk DV >= 2
const MAGNEMITE = 0xad; // unlisted -> genderless
const MEWTWO = 0x83; // unlisted -> genderless

describe("Shin flag byte (wUnusedD721)", () => {
  it("maps to file offset 0x29cd and version/seed/streak to 0x2ce6/0x2ce7/0x284f", () => {
    // d721/da3a/da3b/d5a3 relative to wPokedexOwned d2f7 at 0x25a3.
    expect(SHIN_FLAGS_OFFSET).toBe(0x29cd);
    expect(ROM_HACK_VERSION_OFFSET).toBe(0x2ce6);
    expect(RANDOMIZER_SEED_OFFSET).toBe(0x2ce7);
    expect(WIN_STREAK_OFFSET).toBe(0x284f);
  });

  it("reads and writes the underground NPC win streak with clamping", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    setWinStreak(bytes, 5);
    expect(getWinStreak(bytes)).toBe(5);
    expect(bytes[WIN_STREAK_OFFSET]).toBe(5);
    setWinStreak(bytes, 999);
    expect(getWinStreak(bytes)).toBe(255);
  });

  it("reads and writes individual option bits without touching others", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    bytes[SHIN_FLAGS_OFFSET] = 0b0000_1010; // battle-temp bits set

    setShinFlag(bytes, "nuzlocke", true); // bit 6
    setShinFlag(bytes, "femaleTrainer", true); // bit 0
    let flags = getShinFlags(bytes);
    expect(flags.nuzlocke).toBe(true);
    expect(flags.femaleTrainer).toBe(true);
    expect(flags.sixtyFps).toBe(false);
    expect(bytes[SHIN_FLAGS_OFFSET] & 0b0000_1010).toBe(0b0000_1010); // untouched bits

    setShinFlag(bytes, "nuzlocke", false);
    flags = getShinFlags(bytes);
    expect(flags.nuzlocke).toBe(false);
    expect(flags.femaleTrainer).toBe(true);
  });

  it("exposes 60fps, obedience cap, and GBC colors bits", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    setShinFlag(bytes, "sixtyFps", true); // bit 4
    setShinFlag(bytes, "obedienceCap", true); // bit 5
    setShinFlag(bytes, "gbcColors", true); // bit 7
    expect(bytes[SHIN_FLAGS_OFFSET]).toBe(0b1011_0000);
  });
});

describe("genderOf", () => {
  it("derives gender from the attack DV like DetermineMonGender", () => {
    expect(genderOf(PIKACHU, 8)).toBe("male");
    expect(genderOf(PIKACHU, 7)).toBe("female");
    expect(genderOf(BULBASAUR, 2)).toBe("male");
    expect(genderOf(BULBASAUR, 1)).toBe("female");
  });

  it("handles male-only, female-only, and genderless species", () => {
    expect(genderOf(NIDORAN_M, 0)).toBe("male");
    expect(genderOf(NIDORAN_F, 15)).toBe("female");
    expect(genderOf(MAGNEMITE, 10)).toBeNull();
    expect(genderOf(MEWTWO, 10)).toBeNull();
  });
});

describe("shiny DVs (Gen 2 rule, ShinyDVsChecker)", () => {
  it("requires def/spd/spc = 10 and attack bit 1 set", () => {
    expect(isShinyDvs({ atk: 15, def: 10, spd: 10, spc: 10 })).toBe(true);
    expect(isShinyDvs({ atk: 2, def: 10, spd: 10, spc: 10 })).toBe(true);
    expect(isShinyDvs({ atk: 1, def: 10, spd: 10, spc: 10 })).toBe(false); // atk bit 1 clear
    expect(isShinyDvs({ atk: 15, def: 9, spd: 10, spc: 10 })).toBe(false);
    expect(isShinyDvs({ atk: 15, def: 10, spd: 10, spc: 11 })).toBe(false);
  });

  it("makeShinyDvs produces shiny DVs while keeping attack as high as allowed", () => {
    const shiny = makeShinyDvs({ atk: 13, def: 3, spd: 7, spc: 0 });
    expect(isShinyDvs(shiny)).toBe(true);
    expect(shiny.atk).toBe(15); // 13 | 2 = 15
    expect(shiny.def).toBe(10);
    expect(shiny.spd).toBe(10);
    expect(shiny.spc).toBe(10);
  });
});
