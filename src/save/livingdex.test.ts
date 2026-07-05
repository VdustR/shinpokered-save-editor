import { describe, expect, it } from "vitest";
import { createMon } from "./derive";
import { DEX_SPECIES } from "./gamedata";
import { fillLivingDex } from "./livingdex";
import { isDexOwned, isDexSeen, readBox, setPartyMon, setPlayerId, writeBoxMon } from "./savefile";

const BULBASAUR = 153;

describe("fillLivingDex", () => {
  it("adds every missing species in dex order and marks the dex", () => {
    const bytes = new Uint8Array(0x8000);
    setPlayerId(bytes, 0x1234);
    const result = fillLivingDex(bytes, "VIPRO");
    expect(result.added).toBe(DEX_SPECIES.length); // 151
    expect(result.skippedForSpace).toBe(0);

    const box1 = readBox(bytes, 0);
    expect(box1.mons).toHaveLength(20);
    expect(box1.mons[0].mon.species).toBe(BULBASAUR); // dex #001
    expect(box1.mons[0].mon.level).toBe(5);
    expect(box1.mons[0].nickname).toBe("BULBASAUR");
    expect(box1.mons[0].mon.otId).toBe(0x1234); // not an outsider mon
    // 151 = 7 full boxes + 11 in box 8.
    expect(readBox(bytes, 7).mons).toHaveLength(11);
    expect(readBox(bytes, 8).mons).toHaveLength(0);
    expect(isDexOwned(bytes, 1)).toBe(true);
    expect(isDexSeen(bytes, 151)).toBe(true);
    // Boxes are marked initialized so the game's first in-game box switch
    // does not wipe them, and untouched boxes are valid empties.
    expect(bytes[0x284c] & 0x80).toBe(0x80);
    expect(readBox(bytes, 11).initialized).toBe(true);
  });

  it("marks the dex for species already present with unset dex bits", () => {
    const bytes = new Uint8Array(0x8000);
    setPartyMon(bytes, 0, createMon(BULBASAUR, 42), { nickname: "LEAFY", otName: "V" });
    expect(isDexOwned(bytes, 1)).toBe(false);
    fillLivingDex(bytes, "VIPRO");
    expect(isDexOwned(bytes, 1)).toBe(true);
    expect(isDexSeen(bytes, 1)).toBe(true);
  });

  it("skips species already in the party or boxes and keeps existing mons", () => {
    const bytes = new Uint8Array(0x8000);
    setPartyMon(bytes, 0, createMon(BULBASAUR, 42), { nickname: "LEAFY", otName: "V" });
    const pikachu = DEX_SPECIES.find((sp) => sp.name === "PIKACHU")!;
    writeBoxMon(bytes, 3, 0, createMon(pikachu.internalId, 9), { nickname: "PIKA", otName: "V" });

    const result = fillLivingDex(bytes, "VIPRO");
    expect(result.added).toBe(DEX_SPECIES.length - 2);

    // The existing box mon is untouched and no duplicate was added.
    const all = [];
    for (let b = 0; b < 12; b++) all.push(...readBox(bytes, b).mons);
    expect(all.filter((s) => s.mon.species === pikachu.internalId)).toHaveLength(1);
    expect(all.filter((s) => s.mon.species === BULBASAUR)).toHaveLength(0);
    expect(readBox(bytes, 3).mons[0].nickname).toBe("PIKA");
  });

  it("reports species that no longer fit", () => {
    const bytes = new Uint8Array(0x8000);
    // Fill every slot of every box except one with a single species.
    const filler = createMon(BULBASAUR, 5);
    for (let b = 0; b < 12; b++) {
      for (let s = 0; s < 20; s++) {
        if (b === 11 && s === 19) break;
        writeBoxMon(bytes, b, s, filler, { nickname: "BULBASAUR", otName: "V" });
      }
    }
    const result = fillLivingDex(bytes, "VIPRO");
    expect(result.added).toBe(1); // only one free slot
    expect(result.skippedForSpace).toBe(DEX_SPECIES.length - 1 - 1); // minus bulbasaur present
  });
});
