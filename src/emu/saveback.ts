/**
 * Detecting a real in-game save: Gen 1 constantly writes sprite-decompression
 * scratch into SRAM bank 0 (sram.asm: sSpriteBuffer0-2), so cartridge-RAM
 * write callbacks fire during normal play. An actual SAVE always rewrites the
 * bank-1 main region — player name (0x2598) through the main checksum
 * (0x3523) — so only changes there count.
 */
const MAIN_START = 0x2598;
const MAIN_END = 0x3523; // inclusive: sMainDataCheckSum

export function mainSaveRegionChanged(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length <= MAIN_END || b.length <= MAIN_END) return false;
  for (let i = MAIN_START; i <= MAIN_END; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}
