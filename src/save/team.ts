/**
 * Whole-team convenience operations.
 */
import { moveInfo } from "./gamedata";
import { makePpByte, maxPp, ppUps, type MonRecord } from "./pokemon";
import { getParty, setPartyMon } from "./savefile";

/**
 * Pokémon Center treatment for the whole party: full HP, no status, and
 * every move's PP restored to its maximum for the stored PP-Up count.
 */
export function healParty(bytes: Uint8Array): void {
  const party = getParty(bytes);
  party.forEach((slot, i) => {
    const mon: MonRecord = structuredClone(slot.mon);
    mon.currentHp = mon.maxHp ?? mon.currentHp;
    mon.status = 0;
    mon.pp = mon.pp.map((byte, slotIdx) => {
      const info = mon.moves[slotIdx] ? moveInfo(mon.moves[slotIdx]) : undefined;
      if (!info) return 0;
      const ups = ppUps(byte);
      return makePpByte(maxPp(info.pp, ups), ups);
    }) as MonRecord["pp"];
    setPartyMon(bytes, i, mon, { nickname: slot.nickname, otName: slot.otName });
  });
}
