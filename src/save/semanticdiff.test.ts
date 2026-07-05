import { describe, expect, it } from "vitest";
import { createMon } from "./derive";
import { setEventFlag } from "./events";
import {
  setBadge,
  setBagItems,
  setDexOwned,
  setMoney,
  setPartyMon,
  setPlayerName,
  writeBoxMon,
} from "./savefile";
import { semanticDiff } from "./semanticdiff";

const BULBASAUR = 153;

function blank(): Uint8Array {
  return new Uint8Array(0x8000);
}

function section(sections: ReturnType<typeof semanticDiff>, title: string) {
  return sections.find((s) => s.title === title);
}

describe("semanticDiff", () => {
  it("returns nothing for identical saves", () => {
    expect(semanticDiff(blank(), blank())).toEqual([]);
  });

  it("reports trainer-level changes with readable values", () => {
    const a = blank();
    const b = blank();
    setPlayerName(a, "RED");
    setPlayerName(b, "BLUE");
    setMoney(a, 100);
    setMoney(b, 999999);
    setBadge(b, 0, true);
    const trainer = section(semanticDiff(a, b), "Trainer");
    expect(trainer?.entries).toContainEqual({ label: "Player name", from: "RED", to: "BLUE" });
    expect(trainer?.entries).toContainEqual({ label: "Money", from: "100", to: "999,999" });
    expect(trainer?.entries).toContainEqual({ label: "Boulder Badge", from: "—", to: "earned" });
  });

  it("reports party additions and field-level changes", () => {
    const a = blank();
    const b = blank();
    const mon = createMon(BULBASAUR, 5);
    setPartyMon(a, 0, mon, { nickname: "LEAFY", otName: "V" });
    const grown = createMon(BULBASAUR, 42);
    setPartyMon(b, 0, grown, { nickname: "LEAFY", otName: "V" });
    setPartyMon(b, 1, createMon(BULBASAUR, 7), { nickname: "BULBASAUR", otName: "V" });

    const party = section(semanticDiff(a, b), "Party");
    expect(party?.entries.some((e) => e.label.includes("Slot 1") && /level 5 → 42/.test(e.to))).toBe(true);
    expect(party?.entries.some((e) => e.label === "Slot 2" && e.from === "empty")).toBe(true);
  });

  it("reports box species deltas as a multiset (reorders stay quiet)", () => {
    const a = blank();
    const b = blank();
    const mon = createMon(BULBASAUR, 5);
    writeBoxMon(a, 2, 0, mon, { nickname: "BULBASAUR", otName: "V" });
    writeBoxMon(b, 2, 0, mon, { nickname: "BULBASAUR", otName: "V" });
    writeBoxMon(b, 2, 1, mon, { nickname: "BULBASAUR", otName: "V" });
    const boxes = section(semanticDiff(a, b), "Boxes");
    expect(boxes?.entries).toHaveLength(1);
    expect(boxes?.entries[0].label).toBe("Box 3");
    expect(boxes?.entries[0].to).toContain("+BULBASAUR");
  });

  it("reports item quantity changes, dex changes, and story flags", () => {
    const a = blank();
    const b = blank();
    setBagItems(b, [{ id: 1, count: 5 }]);
    setDexOwned(b, 1, true);
    setEventFlag(b, 0, true); // named: EVENT_FOLLOWED_OAK_INTO_LAB
    setEventFlag(b, 0x90e, true); // unnamed but game-used
    const d = semanticDiff(a, b);
    expect(section(d, "Bag")?.entries[0]).toMatchObject({ from: "×0", to: "×5" });
    expect(section(d, "Pokédex")?.entries.some((e) => e.label.includes("+BULBASAUR"))).toBe(true);
    const flags = section(d, "Flags & world");
    expect(flags?.entries.some((e) => e.to.includes("+EVENT_FOLLOWED_OAK_INTO_LAB"))).toBe(true);
    expect(flags?.entries.some((e) => e.label === "Unnamed flags changed" && e.to === "1")).toBe(true);
  });

  it("always includes the raw changed-byte count when anything differs", () => {
    const a = blank();
    const b = blank();
    b[0x100] = 1;
    const d = semanticDiff(a, b);
    expect(section(d, "Raw")?.entries[0].to).toBe("1");
  });
});
