import { describe, expect, it } from "vitest";
import {
  EVENT_FLAGS,
  EVENT_FLAGS_OFFSET,
  UNNAMED_EVENT_FLAGS,
  eventFlagLabel,
  getEventFlag,
  setEventFlag,
} from "./events";
import { SAVE_SIZE } from "./layout";

describe("event flags", () => {
  it("stores flags at wEventFlags (d747 -> 0x29f3)", () => {
    expect(EVENT_FLAGS_OFFSET).toBe(0x29f3);
  });

  it("reads and writes a bit by its event index", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    // EVENT_GOT_TOWN_MAP = 24 -> byte 3, bit 0.
    expect(getEventFlag(bytes, 24)).toBe(false);
    setEventFlag(bytes, 24, true);
    expect(getEventFlag(bytes, 24)).toBe(true);
    expect(bytes[0x29f3 + 3]).toBe(0b0000_0001);
    setEventFlag(bytes, 24, false);
    expect(bytes[0x29f3 + 3]).toBe(0);
  });

  it("does not disturb neighbouring bits", () => {
    const bytes = new Uint8Array(SAVE_SIZE);
    bytes[0x29f3] = 0b1010_1010;
    setEventFlag(bytes, 0, true); // bit 0 of byte 0
    expect(bytes[0x29f3]).toBe(0b1010_1011);
    setEventFlag(bytes, 1, false); // bit 1 was set
    expect(bytes[0x29f3]).toBe(0b1010_1001);
  });

  it("exposes the generated named flag list", () => {
    expect(EVENT_FLAGS.length).toBeGreaterThan(400);
    const townMap = EVENT_FLAGS.find((f) => f.name === "EVENT_GOT_TOWN_MAP");
    expect(townMap?.index).toBe(24);
  });

  it("labels computed Nuzlocke encounter-area bits instead of calling them unused", () => {
    // func_nuzlocke.asm addresses EVENT_980 + list index indirectly, so
    // EVENT_981.. never appear as literals but are live state.
    const first = UNNAMED_EVENT_FLAGS.find((f) => f.index === 0x980);
    expect(first?.label).toContain("Celadon City");
    expect(first?.label).toContain("Nuzlocke");
    const second = UNNAMED_EVENT_FLAGS.find((f) => f.index === 0x981);
    expect(second?.label).toContain("Cerulean Cave");
    expect(second?.label).not.toContain("unused");
    // One past the 44-entry list is back to verified unused.
    const past = UNNAMED_EVENT_FLAGS.find((f) => f.index === 0x980 + 44);
    expect(past?.label).toContain("(unused)");
  });

  it("derives semantics for used-but-unnamed bits and marks the rest unused", () => {
    // EVENT_908 is referenced all over the code with the comment "has e4 been beaten?".
    const used = UNNAMED_EVENT_FLAGS.find((f) => f.index === 0x908);
    expect(used?.label).toContain("$908");
    expect(used?.label).toContain("has e4 been beaten?");
    expect(used?.usedIn?.length).toBeGreaterThan(3);
    // A dead bit carries the verified-unused marker.
    const dead = UNNAMED_EVENT_FLAGS.find((f) => f.index === 0x004);
    expect(dead?.label).toBe("Unnamed $004 (unused)");
    expect(dead?.usedIn).toBeUndefined();
    // Full coverage of the 320-byte array alongside the named flags.
    expect(UNNAMED_EVENT_FLAGS.length + EVENT_FLAGS.length).toBe(2560);
  });

  it("prettifies constant names into readable sentence-case labels", () => {
    expect(eventFlagLabel("EVENT_GOT_TOWN_MAP")).toBe("Got town map");
    expect(eventFlagLabel("EVENT_BEAT_BROCK")).toBe("Beat brock");
    expect(eventFlagLabel("EVENT_2ND_ROUTE22_RIVAL_BATTLE")).toBe("2nd route22 rival battle");
  });
});
