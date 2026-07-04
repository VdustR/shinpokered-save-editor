import { describe, expect, it } from "vitest";
import { repairChecksums } from "./checksum";
import { NAME_LENGTH, OFFSETS, SAVE_SIZE, storedBoxOffset } from "./layout";
import { writeMon, type MonRecord } from "./pokemon";
import {
  exportSave,
  getBadges,
  getBagItems,
  getCoins,
  getCurrentBoxIndex,
  getMoney,
  getOptions,
  getParty,
  getPlayTime,
  getPlayerId,
  getPlayerName,
  getRivalName,
  isDexOwned,
  isDexSeen,
  parseSave,
  readBox,
  setBadge,
  setBagItems,
  setCoins,
  setDexOwned,
  setDexSeen,
  setMoney,
  setOptions,
  setPartyMon,
  setPlayTime,
  setPlayerId,
  setPlayerName,
  setRivalName,
  writeBoxMon,
} from "./savefile";
import { encodeText } from "./text";

function sampleMon(species = 0x54, level = 5): MonRecord {
  return {
    species,
    currentHp: 19,
    boxLevel: level,
    status: 0,
    types: [0x17, 0x17],
    catchRate: 0xa3,
    moves: [84, 39, 0, 0],
    otId: 0x1234,
    exp: 135,
    statExp: { hp: 0, atk: 0, def: 0, spd: 0, spc: 0 },
    dvs: { atk: 10, def: 11, spd: 12, spc: 13 },
    pp: [30, 30, 0, 0],
    level,
    maxHp: 19,
    stats: { atk: 9, def: 9, spd: 12, spc: 10 },
  };
}

/** Build a minimal but structurally valid save. */
function buildTestSave(): Uint8Array {
  const bytes = new Uint8Array(SAVE_SIZE);
  bytes.set(encodeText("RED", NAME_LENGTH), OFFSETS.playerName);
  bytes.set(encodeText("BLUE", NAME_LENGTH), OFFSETS.rivalName);
  bytes.set([0x01, 0x23, 0x45], OFFSETS.money); // 12345
  bytes.set([0x00, 0x50], OFFSETS.coins); // 50
  bytes[OFFSETS.badges] = 0b0000_0011; // Boulder + Cascade
  bytes[OFFSETS.playerId] = 0x56;
  bytes[OFFSETS.playerId + 1] = 0x78;
  bytes[OFFSETS.options] = 0x01; // fast text
  bytes[OFFSETS.playTimeHours] = 12;
  bytes[OFFSETS.playTimeMinutes] = 34;
  bytes[OFFSETS.playTimeSeconds] = 56;
  // Party: one Pikachu.
  bytes[OFFSETS.partyCount] = 1;
  bytes[OFFSETS.partySpecies] = 0x54;
  bytes[OFFSETS.partySpecies + 1] = 0xff;
  writeMon(bytes, OFFSETS.partyMons, sampleMon(), true);
  bytes.set(encodeText("RED", NAME_LENGTH), OFFSETS.partyMonOts);
  bytes.set(encodeText("PIKA", NAME_LENGTH), OFFSETS.partyMonNicks);
  // Empty current box (box 1 current).
  bytes[OFFSETS.currentBoxNum] = 0;
  bytes[OFFSETS.currentBox] = 0;
  bytes[OFFSETS.currentBox + 1] = 0xff;
  // Empty stored boxes: count 0, species terminator.
  for (let i = 0; i < 12; i++) {
    const off = storedBoxOffset(i);
    bytes[off] = 0;
    bytes[off + 1] = 0xff;
  }
  // Bag: 2 potions, 1 poke ball.
  setBagItems(bytes, [
    { id: 0x14, count: 2 },
    { id: 0x04, count: 1 },
  ]);
  // Dex: own #25, see #25 and #1.
  setDexOwned(bytes, 25, true);
  setDexSeen(bytes, 25, true);
  setDexSeen(bytes, 1, true);
  repairChecksums(bytes);
  return bytes;
}

describe("parseSave", () => {
  it("accepts exactly 32 KiB", () => {
    const parsed = parseSave(buildTestSave());
    expect(parsed.bytes.length).toBe(SAVE_SIZE);
    expect(parsed.warnings).toEqual([]);
  });

  it("accepts oversized files (emulator padding) with a warning", () => {
    const big = new Uint8Array(SAVE_SIZE + 16);
    big.set(buildTestSave(), 0);
    const parsed = parseSave(big);
    expect(parsed.bytes.length).toBe(SAVE_SIZE);
    expect(parsed.warnings.some((w) => w.includes("trailing"))).toBe(true);
  });

  it("rejects undersized files", () => {
    expect(() => parseSave(new Uint8Array(1000))).toThrow(/32 KiB/);
  });

  it("reports checksum mismatches without repairing", () => {
    const bytes = buildTestSave();
    bytes[0x2600] ^= 1;
    const parsed = parseSave(bytes);
    expect(parsed.checksumMismatches.map((g) => g.id)).toEqual(["main"]);
    expect(parsed.bytes[0x2600]).toBe(bytes[0x2600]); // untouched
  });
});

describe("trainer fields", () => {
  const bytes = buildTestSave();

  it("reads identity, money, coins, badges, options, play time", () => {
    expect(getPlayerName(bytes)).toBe("RED");
    expect(getRivalName(bytes)).toBe("BLUE");
    expect(getMoney(bytes)).toBe(12345);
    expect(getCoins(bytes)).toBe(50);
    expect(getPlayerId(bytes)).toBe(0x5678);
    expect(getBadges(bytes)).toEqual([true, true, false, false, false, false, false, false]);
    expect(getOptions(bytes)).toEqual({ textSpeed: 1, battleAnimationOff: false, battleStyleSet: false });
    expect(getPlayTime(bytes)).toEqual({ hours: 12, minutes: 34, seconds: 56, maxed: false });
  });

  it("writes fields and reads them back", () => {
    const copy = Uint8Array.from(bytes);
    setPlayerName(copy, "ASH");
    setRivalName(copy, "GARY");
    setMoney(copy, 999999);
    setCoins(copy, 9999);
    setPlayerId(copy, 0xabcd);
    setBadge(copy, 7, true);
    setOptions(copy, { textSpeed: 5, battleAnimationOff: true, battleStyleSet: true });
    setPlayTime(copy, { hours: 255, minutes: 59, seconds: 59, maxed: false });
    expect(getPlayerName(copy)).toBe("ASH");
    expect(getRivalName(copy)).toBe("GARY");
    expect(getMoney(copy)).toBe(999999);
    expect(getCoins(copy)).toBe(9999);
    expect(getPlayerId(copy)).toBe(0xabcd);
    expect(getBadges(copy)[7]).toBe(true);
    expect(getOptions(copy)).toEqual({ textSpeed: 5, battleAnimationOff: true, battleStyleSet: true });
    expect(getPlayTime(copy).hours).toBe(255);
  });
});

describe("pokedex", () => {
  it("uses LSB-first bit order per byte", () => {
    const bytes = buildTestSave();
    // Dex #25 -> byte 3, bit 0.
    expect(bytes[OFFSETS.pokedexOwned + 3] & 1).toBe(1);
    expect(isDexOwned(bytes, 25)).toBe(true);
    expect(isDexSeen(bytes, 1)).toBe(true);
    expect(isDexOwned(bytes, 1)).toBe(false);
    setDexOwned(bytes, 151, true);
    expect(isDexOwned(bytes, 151)).toBe(true);
    setDexOwned(bytes, 151, false);
    expect(isDexOwned(bytes, 151)).toBe(false);
  });
});

describe("items", () => {
  it("round-trips bag items with terminator", () => {
    const bytes = buildTestSave();
    expect(getBagItems(bytes)).toEqual([
      { id: 0x14, count: 2 },
      { id: 0x04, count: 1 },
    ]);
    expect(bytes[OFFSETS.bagItemCount]).toBe(2);
    expect(bytes[OFFSETS.bagItems + 4]).toBe(0xff);
    setBagItems(bytes, [{ id: 0x01, count: 99 }]);
    expect(getBagItems(bytes)).toEqual([{ id: 0x01, count: 99 }]);
  });

  it("rejects more items than capacity", () => {
    const bytes = buildTestSave();
    const tooMany = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, count: 1 }));
    expect(() => setBagItems(bytes, tooMany)).toThrow(/capacity/i);
  });
});

describe("party", () => {
  it("reads the party with names", () => {
    const party = getParty(buildTestSave());
    expect(party).toHaveLength(1);
    expect(party[0].mon.species).toBe(0x54);
    expect(party[0].nickname).toBe("PIKA");
    expect(party[0].otName).toBe("RED");
  });

  it("writes a mon and keeps the species list in sync", () => {
    const bytes = buildTestSave();
    setPartyMon(bytes, 1, sampleMon(0x99, 10), { nickname: "BULBA", otName: "ASH" });
    expect(bytes[OFFSETS.partyCount]).toBe(2);
    expect(bytes[OFFSETS.partySpecies + 1]).toBe(0x99);
    expect(bytes[OFFSETS.partySpecies + 2]).toBe(0xff);
    const party = getParty(bytes);
    expect(party[1].mon.species).toBe(0x99);
    expect(party[1].nickname).toBe("BULBA");
  });
});

describe("boxes", () => {
  it("reads the current box from the bank-1 cache", () => {
    const bytes = buildTestSave();
    expect(getCurrentBoxIndex(bytes)).toBe(0);
    writeBoxMon(bytes, 0, 0, sampleMon(0x99, 7), { nickname: "IVY", otName: "RED" });
    const box = readBox(bytes, 0);
    expect(box.mons).toHaveLength(1);
    expect(box.mons[0].mon.species).toBe(0x99);
    // Current box writes go to both the cache and the stored slot.
    expect(bytes[OFFSETS.currentBox]).toBe(1);
    expect(bytes[storedBoxOffset(0)]).toBe(1);
  });

  it("writes non-current boxes only to storage", () => {
    const bytes = buildTestSave();
    writeBoxMon(bytes, 3, 0, sampleMon(0x99, 7), { nickname: "IVY", otName: "RED" });
    expect(bytes[storedBoxOffset(3)]).toBe(1);
    expect(bytes[OFFSETS.currentBox]).toBe(0);
    expect(readBox(bytes, 3).mons).toHaveLength(1);
  });
});

describe("exportSave", () => {
  it("is byte-identical for a no-op on a valid save", () => {
    const bytes = buildTestSave();
    const out = exportSave(bytes);
    expect(Array.from(out)).toEqual(Array.from(bytes));
    expect(out).not.toBe(bytes);
  });

  it("repairs checksums after edits", () => {
    const bytes = buildTestSave();
    setMoney(bytes, 424242);
    const out = exportSave(bytes);
    expect(parseSave(out).checksumMismatches).toEqual([]);
    expect(getMoney(out)).toBe(424242);
  });
});
