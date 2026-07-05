/**
 * Whole-team convenience operations.
 */
import { moveInfo } from "./gamedata";
import { OFFSETS, PARTY_MON_SIZE } from "./layout";
import { makePpByte, maxPp, ppUps, writeMon, type MonRecord } from "./pokemon";
import { getParty } from "./savefile";

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
    // Write only the mon record: healing must not re-encode name fields,
    // which can rewrite non-canonical padding or throw on undecodable bytes.
    writeMon(bytes, OFFSETS.partyMons + i * PARTY_MON_SIZE, mon, true);
  });
}
