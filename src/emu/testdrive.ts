import { Gameboy } from "@neil-morrison44/gameboy-emulator";
import { toTightBuffer } from "./rom";

export interface TestDrive {
  stop: () => void;
  /** Current cartridge SRAM (32 KiB) — the in-emulator save. */
  readSram: () => Uint8Array | null;
}

export interface TestDriveOptions {
  rom: Uint8Array;
  /** Export-quality save bytes (checksums already repaired). */
  save: Uint8Array;
  canvas: HTMLCanvasElement;
  sound: boolean;
}

/**
 * Boot a ROM with the edited save injected as cartridge SRAM.
 *
 * The emulator package uses module-level singletons (memory, keyboard), so
 * only one instance may run at a time; callers must stop() the previous
 * drive before starting a new one. Order matters: loadGame creates the MBC3
 * cartridge, setCartridgeSaveRam replaces its RAM, run() resets only the
 * 64 KB address space and leaves cartridge RAM alone.
 */
export function startTestDrive({ rom, save, canvas, sound }: TestDriveOptions): TestDrive {
  const gameboy = new Gameboy({ sound });
  gameboy.loadGame(toTightBuffer(rom));
  gameboy.setCartridgeSaveRam(toTightBuffer(save));

  const ctx = canvas.getContext("2d");
  gameboy.onFrameFinished((image: ImageData) => {
    ctx?.putImageData(image, 0, 0);
  });

  // WASD-free defaults: arrows move, X=A, Z=B, Enter=Start, Shift=Select.
  gameboy.keyboardManager.a = "KeyX";
  gameboy.keyboardManager.b = "KeyZ";
  gameboy.keyboardManager.start = "Enter";
  gameboy.keyboardManager.select = "ShiftRight";

  if (sound) gameboy.apu?.enableSound();
  gameboy.run();

  return {
    stop: () => gameboy.stop(),
    readSram: () => {
      const sram = gameboy.getCartridgeSaveRam();
      // The mapper only ever addresses the first 32 KiB; anything beyond is
      // over-allocation from the library's ram-size table.
      return sram ? new Uint8Array(sram).slice(0, 0x8000) : null;
    },
  };
}
