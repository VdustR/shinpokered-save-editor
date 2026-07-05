import { Gameboy } from "@neil-morrison44/gameboy-emulator";
import { toTightBuffer } from "./rom";

export type GbButton = "up" | "down" | "left" | "right" | "a" | "b" | "start" | "select";

const INPUT_FLAGS = {
  up: "isPressingUp",
  down: "isPressingDown",
  left: "isPressingLeft",
  right: "isPressingRight",
  a: "isPressingA",
  b: "isPressingB",
  start: "isPressingStart",
  select: "isPressingSelect",
} as const;

export interface TestDrive {
  stop: () => void;
  /** Current cartridge SRAM (32 KiB) — the in-emulator save. */
  readSram: () => Uint8Array | null;
  /** Press/release a button programmatically (virtual gamepad). */
  setButton: (button: GbButton, pressed: boolean) => void;
}

export interface TestDriveOptions {
  rom: Uint8Array;
  /** Export-quality save bytes (checksums already repaired). */
  save: Uint8Array;
  canvas: HTMLCanvasElement;
  sound: boolean;
  /**
   * Called (debounced ~500 ms by the emulator) after the game writes
   * cartridge RAM, with a copy of the current 32 KiB SRAM. Note Gen 1 also
   * uses SRAM bank 0 as sprite scratch, so a callback does not imply an
   * in-game save — filter with mainSaveRegionChanged.
   */
  onSramWrite?: (sram: Uint8Array) => void;
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
export function startTestDrive({ rom, save, canvas, sound, onSramWrite }: TestDriveOptions): TestDrive {
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

  if (onSramWrite) {
    gameboy.setOnWriteToCartridgeRam((ram: ArrayBuffer) => onSramWrite(new Uint8Array(ram).slice(0, 0x8000)));
  }

  if (sound) gameboy.apu?.enableSound();
  gameboy.run();

  const releaseAllButtons = () => {
    for (const flag of Object.values(INPUT_FLAGS)) gameboy.input[flag] = false;
  };

  return {
    stop: () => {
      releaseAllButtons(); // no stuck inputs across restarts
      gameboy.stop();
    },
    setButton: (button, pressed) => {
      gameboy.input[INPUT_FLAGS[button]] = pressed;
    },
    readSram: () => {
      const sram = gameboy.getCartridgeSaveRam();
      // The mapper only ever addresses the first 32 KiB; anything beyond is
      // over-allocation from the library's ram-size table.
      return sram ? new Uint8Array(sram).slice(0, 0x8000) : null;
    },
  };
}
