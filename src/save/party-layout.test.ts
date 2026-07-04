import { describe, expect, it } from "vitest";
import { NAME_LENGTH, OFFSETS, PARTY_LENGTH, PARTY_MON_SIZE, SAVE_SIZE } from "./layout";
import { getParty, setPartyMon } from "./savefile";
import { encodeText } from "./text";
import { createMon } from "./derive";

/**
 * Regression for the party name-region offsets. The party block layout is
 * (wram.asm, base wPartyCount d163 <-> file 0x2f2c):
 *   count(1) species(7) mons(6*44) OTs(6*11) nicks(6*11)
 * OTs therefore start at 0x2f2c + (d273 - d163) = 0x303c and nicknames at
 * 0x2f2c + (d2b5 - d163) = 0x307e. A previous version computed these with the
 * 33-byte box record size, landing inside the party records themselves: an OT
 * write for slot 3 started at that record's level byte, so editing a slot-3
 * mon overwrote its level with "R" (0x91 = 145) from the OT name.
 */
describe("party name-region offsets", () => {
  it("places OTs and nicknames after all six party records", () => {
    expect(OFFSETS.partyMonOts).toBe(0x303c);
    expect(OFFSETS.partyMonNicks).toBe(0x307e);
    // Must not overlap the record area.
    const monsEnd = OFFSETS.partyMons + PARTY_LENGTH * PARTY_MON_SIZE;
    expect(OFFSETS.partyMonOts).toBeGreaterThanOrEqual(monsEnd);
    expect(OFFSETS.partyMonNicks).toBe(OFFSETS.partyMonOts + PARTY_LENGTH * NAME_LENGTH);
    // The nickname region ends exactly where the next file section
    // (sCurBoxData) begins: sPartyData spans wPartyDataStart..wPartyDataEnd.
    expect(OFFSETS.partyMonNicks + PARTY_LENGTH * NAME_LENGTH).toBe(OFFSETS.currentBox);
  });

  it("writing any slot's names never touches another slot's record bytes", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    bytes[OFFSETS.partySpecies] = 0xff;
    // Fill all six slots, then rewrite each slot's names and check the other records.
    for (let s = 0; s < PARTY_LENGTH; s++) {
      setPartyMon(bytes, s, createMon(0x99, 10 + s), { nickname: "AAAAAAAAAA", otName: "BBBBBBBBBB" });
    }
    const recordsBefore = bytes.slice(OFFSETS.partyMons, OFFSETS.partyMons + PARTY_LENGTH * PARTY_MON_SIZE);
    for (let s = 0; s < PARTY_LENGTH; s++) {
      setPartyMon(bytes, s, createMon(0x99, 10 + s), { nickname: "CCCCCCCCCC", otName: "DDDDDDDDDD" });
    }
    const recordsAfter = bytes.slice(OFFSETS.partyMons, OFFSETS.partyMons + PARTY_LENGTH * PARTY_MON_SIZE);
    expect(Array.from(recordsAfter)).toEqual(Array.from(recordsBefore));
  });

  it("round-trips names through the game's own regions", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    bytes[OFFSETS.partySpecies] = 0xff;
    setPartyMon(bytes, 0, createMon(0x99, 7), { nickname: "LEAFY", otName: "VIOLET" });
    // The bytes must land exactly where the game reads them.
    expect(Array.from(bytes.slice(0x303c, 0x303c + 7))).toEqual(Array.from(encodeText("VIOLET", 7)));
    expect(Array.from(bytes.slice(0x307e, 0x307e + 6))).toEqual(Array.from(encodeText("LEAFY", 6)));
    const party = getParty(bytes);
    expect(party[0].nickname).toBe("LEAFY");
    expect(party[0].otName).toBe("VIOLET");
  });
});
