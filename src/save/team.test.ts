import { describe, expect, it } from "vitest";
import { createMon } from "./derive";
import { getParty, setPartyMon } from "./savefile";
import { makePpByte } from "./pokemon";
import { healParty } from "./team";

const BULBASAUR = 153;

describe("healParty", () => {
  it("restores HP, clears status, and refills PP preserving PP Ups", () => {
    const bytes = new Uint8Array(0x8000);
    const mon = createMon(BULBASAUR, 20);
    mon.currentHp = 3;
    mon.status = 0x40; // paralyzed
    // TACKLE with 2 PP Ups, nearly empty: 35 base -> max 35 + 2*7 = 49.
    mon.moves = [33, 45, 0, 0];
    mon.pp = [makePpByte(1, 2), makePpByte(0, 0), 0, 0];
    setPartyMon(bytes, 0, mon, { nickname: "LEAFY", otName: "VIPRO" });

    healParty(bytes);

    const healed = getParty(bytes)[0];
    expect(healed.mon.currentHp).toBe(healed.mon.maxHp);
    expect(healed.mon.status).toBe(0);
    expect(healed.mon.pp[0]).toBe(makePpByte(49, 2)); // ups preserved
    expect(healed.mon.pp[1]).toBe(makePpByte(40, 0)); // GROWL 40
    expect(healed.mon.pp[2]).toBe(0); // empty slot untouched
    expect(healed.nickname).toBe("LEAFY"); // names untouched
  });
});
