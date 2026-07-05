import { describe, expect, it } from "vitest";
import { assessRom, parseRomHeader } from "./rom";

/** Build a minimal 32 KiB ROM with a valid header. */
function fakeRom({ title = "POKEMON RED", type = 0x13 } = {}): Uint8Array {
  const rom = new Uint8Array(0x8000);
  for (let i = 0; i < title.length; i++) rom[0x134 + i] = title.charCodeAt(i);
  rom[0x147] = type;
  let x = 0;
  for (let i = 0x134; i <= 0x14c; i++) x = (x - rom[i] - 1) & 0xff;
  rom[0x14d] = x;
  return rom;
}

describe("parseRomHeader", () => {
  it("reads title, cartridge type, and validates the header checksum", () => {
    const info = parseRomHeader(fakeRom());
    expect(info.title).toBe("POKEMON RED");
    expect(info.cartridgeType).toBe(0x13);
    expect(info.cartridgeTypeName).toBe("MBC3+RAM+BATTERY");
    expect(info.sizeOk).toBe(true);
    expect(info.headerChecksumOk).toBe(true);
    expect(info.mbc3Battery).toBe(true);
  });

  it("rejects a corrupted header checksum", () => {
    const rom = fakeRom();
    rom[0x14d] ^= 0xff;
    expect(parseRomHeader(rom).headerChecksumOk).toBe(false);
  });
});

describe("assessRom", () => {
  it("accepts a well-formed MBC3 battery ROM", () => {
    expect(assessRom(fakeRom()).verdict).toBe("ok");
  });

  it("flags wrong-size files as invalid", () => {
    const a = assessRom(new Uint8Array(1234));
    expect(a.verdict).toBe("invalid");
    expect(a.reasons.join(" ")).toMatch(/32 KiB/);
  });

  it("flags garbage of the right size as invalid via the checksum", () => {
    const garbage = new Uint8Array(0x8000);
    for (let i = 0; i < garbage.length; i++) garbage[i] = (i * 37 + 11) & 0xff;
    expect(assessRom(garbage).verdict).toBe("invalid");
  });

  it("rejects a truncated dump whose header claims a larger ROM", () => {
    const rom = fakeRom();
    rom[0x148] = 0x05; // header says 1 MiB, file is 32 KiB
    let x = 0;
    for (let i = 0x134; i <= 0x14c; i++) x = (x - rom[i] - 1) & 0xff;
    rom[0x14d] = x;
    const a = assessRom(rom);
    expect(a.verdict).toBe("invalid");
    expect(a.reasons.join(" ")).toMatch(/truncated/);
  });

  it("warns on a valid ROM with a non-MBC3 mapper", () => {
    const a = assessRom(fakeRom({ type: 0x1b }));
    expect(a.verdict).toBe("warn");
    expect(a.reasons.join(" ")).toMatch(/MBC5\+RAM\+BATTERY/);
  });
});
