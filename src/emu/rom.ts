/**
 * Game Boy ROM header helpers for the Test Drive feature.
 *
 * Layout facts from Pan Docs: title at 0x0134–0x0143, cartridge type at
 * 0x0147, ROM size code at 0x0148, header checksum at 0x014D computed as
 * x = x - byte - 1 over 0x0134–0x014C.
 */

export interface RomInfo {
  title: string;
  cartridgeType: number;
  cartridgeTypeName: string;
  sizeOk: boolean;
  headerChecksumOk: boolean;
  /** MBC3+RAM+BATTERY — the mapper Pokémon Red (and Shin) uses. */
  mbc3Battery: boolean;
  /** Actual file length matches the ROM size the header (0x148) advertises. */
  declaredSizeOk: boolean;
}

const CARTRIDGE_TYPES: Record<number, string> = {
  0x00: "ROM only",
  0x01: "MBC1",
  0x02: "MBC1+RAM",
  0x03: "MBC1+RAM+BATTERY",
  0x0f: "MBC3+TIMER+BATTERY",
  0x10: "MBC3+TIMER+RAM+BATTERY",
  0x11: "MBC3",
  0x12: "MBC3+RAM",
  0x13: "MBC3+RAM+BATTERY",
  0x19: "MBC5",
  0x1a: "MBC5+RAM",
  0x1b: "MBC5+RAM+BATTERY",
};

export function parseRomHeader(rom: Uint8Array): RomInfo {
  const sizeOk = rom.length >= 0x8000 && rom.length % 0x8000 === 0;
  let title = "";
  let cartridgeType = -1;
  let headerChecksumOk = false;
  let declaredSizeOk = false;
  if (rom.length >= 0x150) {
    for (let i = 0x134; i <= 0x143; i++) {
      const c = rom[i];
      if (c === 0) break;
      title += c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : "?";
    }
    cartridgeType = rom[0x147];
    let x = 0;
    for (let i = 0x134; i <= 0x14c; i++) x = (x - rom[i] - 1) & 0xff;
    headerChecksumOk = x === rom[0x14d];
    // 0x148 advertises the ROM size as 32 KiB << code; a truncated dump can
    // keep a valid header checksum, so compare against the actual length.
    const sizeCode = rom[0x148];
    declaredSizeOk = sizeCode <= 8 && rom.length === 0x8000 << sizeCode;
  }
  return {
    title: title.trim(),
    cartridgeType,
    cartridgeTypeName: CARTRIDGE_TYPES[cartridgeType] ?? `Unknown (0x${cartridgeType.toString(16)})`,
    sizeOk,
    headerChecksumOk,
    mbc3Battery: cartridgeType === 0x13,
    declaredSizeOk,
  };
}

export type RomVerdict = "ok" | "warn" | "invalid";

export interface RomAssessment {
  verdict: RomVerdict;
  info: RomInfo;
  reasons: string[];
}

/** Sanity-check a candidate ROM before offering to boot it. */
export function assessRom(rom: Uint8Array): RomAssessment {
  const info = parseRomHeader(rom);
  const reasons: string[] = [];
  if (!info.sizeOk) reasons.push("File size is not a multiple of 32 KiB — not a Game Boy ROM.");
  if (!info.headerChecksumOk) reasons.push("Header checksum does not match — not a valid Game Boy ROM.");
  if (info.sizeOk && info.headerChecksumOk && !info.declaredSizeOk)
    reasons.push("File length does not match the ROM size the header declares — truncated or padded dump.");
  if (!info.sizeOk || !info.headerChecksumOk || !info.declaredSizeOk)
    return { verdict: "invalid", info, reasons };
  if (!info.mbc3Battery) {
    reasons.push(
      `Cartridge type is ${info.cartridgeTypeName}; save injection expects MBC3+RAM+BATTERY (Pokémon Red).`,
    );
    return { verdict: "warn", info, reasons };
  }
  return { verdict: "ok", info, reasons };
}
