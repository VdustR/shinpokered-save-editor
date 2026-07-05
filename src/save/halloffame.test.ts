import { describe, expect, it } from "vitest";
import { NAME_LENGTH, SAVE_SIZE } from "./layout";
import {
  HOF_CAPACITY,
  HOF_COUNT_OFFSET,
  HOF_MON_SIZE,
  HOF_OFFSET,
  HOF_TEAM_SIZE,
  clearHallOfFame,
  getHofCount,
  readHofTeams,
  setHofCount,
} from "./halloffame";
import { encodeText } from "./text";

function writeHofMon(bytes: Uint8Array, team: number, slot: number, species: number, level: number, nick: string) {
  const off = HOF_OFFSET + team * HOF_TEAM_SIZE + slot * HOF_MON_SIZE;
  bytes[off] = species;
  bytes[off + 1] = level;
  bytes.set(encodeText(nick, NAME_LENGTH), off + 2);
}

describe("hall of fame", () => {
  it("uses the verified layout: bank-0 0x0598, 16-byte mons, 96-byte teams, count at 0x284e", () => {
    expect(HOF_OFFSET).toBe(0x0598);
    expect(HOF_MON_SIZE).toBe(16);
    expect(HOF_TEAM_SIZE).toBe(96);
    expect(HOF_CAPACITY).toBe(50);
    expect(HOF_COUNT_OFFSET).toBe(0x284e);
  });

  it("reads recorded teams up to the stored count, stopping each team at 0xff", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    setHofCount(bytes, 2);
    writeHofMon(bytes, 0, 0, 0x99, 55, "LEAFY");
    writeHofMon(bytes, 0, 1, 0x54, 60, "SPARKY");
    bytes[HOF_OFFSET + 2 * HOF_MON_SIZE] = 0xff; // team 0 has 2 mons
    writeHofMon(bytes, 1, 0, 0xb0, 70, "FLAME");
    bytes[HOF_OFFSET + HOF_TEAM_SIZE + HOF_MON_SIZE] = 0xff;

    expect(getHofCount(bytes)).toBe(2);
    const teams = readHofTeams(bytes);
    expect(teams).toHaveLength(2);
    expect(teams[0].map((m) => m.nickname)).toEqual(["LEAFY", "SPARKY"]);
    expect(teams[0][0]).toMatchObject({ species: 0x99, level: 55 });
    expect(teams[1][0].nickname).toBe("FLAME");
  });

  it("caps stored teams at capacity even when the win counter is higher", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    setHofCount(bytes, 200); // the game keeps counting wins past 50 stored teams
    expect(readHofTeams(bytes).length).toBeLessThanOrEqual(HOF_CAPACITY);
  });

  it("clearHallOfFame zeroes the count and the whole region", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    setHofCount(bytes, 3);
    writeHofMon(bytes, 0, 0, 0x99, 55, "LEAFY");
    clearHallOfFame(bytes);
    expect(getHofCount(bytes)).toBe(0);
    expect(bytes[HOF_OFFSET]).toBe(0);
    expect(readHofTeams(bytes)).toHaveLength(0);
  });
});
