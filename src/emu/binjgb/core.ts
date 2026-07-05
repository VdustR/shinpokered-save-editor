import type { BinjgbInit, BinjgbModule } from "./binjgb";
import Binjgb from "./binjgb.js";
import wasmUrl from "./binjgb.wasm?url";

export const SCREEN_WIDTH = 160;
export const SCREEN_HEIGHT = 144;
export const CPU_TICKS_PER_SECOND = 4194304;

export const EVENT_NEW_FRAME = 1;
export const EVENT_AUDIO_BUFFER_FULL = 2;
export const EVENT_UNTIL_TICKS = 4;

/** Matches simple.js: "Gambatte/Gameboy Online" CGB color curve. */
const CGB_COLOR_CURVE = 2;

let modulePromise: Promise<BinjgbModule> | null = null;

/**
 * Load the vendored wasm module (singleton). Tests pass `wasmBinary` to skip
 * the URL fetch; the browser resolves the wasm through Vite's asset graph.
 */
export function loadBinjgb(init?: BinjgbInit): Promise<BinjgbModule> {
  modulePromise ??= Binjgb({ locateFile: () => wasmUrl, ...init });
  return modulePromise;
}

export type JoypadButton = "up" | "down" | "left" | "right" | "a" | "b" | "start" | "select";

export interface BinjgbCoreOptions {
  sampleRate: number;
  /** Audio frames per generated buffer; simple.js default. */
  audioFrames?: number;
}

/**
 * Thin lifetime wrapper around one emulator instance. Heap views are
 * recreated on each access because Emscripten may replace the backing
 * ArrayBuffer when its memory grows.
 */
export class BinjgbCore {
  private readonly module: BinjgbModule;
  private readonly romPtr: number;
  private readonly e: number;
  private readonly joypadPtr: number;
  private deleted = false;

  static async create(rom: Uint8Array, opts: BinjgbCoreOptions): Promise<BinjgbCore> {
    return new BinjgbCore(await loadBinjgb(), rom, opts);
  }

  private constructor(module: BinjgbModule, rom: Uint8Array, opts: BinjgbCoreOptions) {
    this.module = module;
    // binjgb requires the ROM buffer size to be a multiple of 32 KiB.
    const size = (rom.length + 0x7fff) & ~0x7fff;
    this.romPtr = module._malloc(size);
    this.heap(this.romPtr, size).fill(0).set(rom);
    this.e = module._emulator_new_simple(
      this.romPtr,
      size,
      opts.sampleRate,
      opts.audioFrames ?? 4096,
      CGB_COLOR_CURVE,
    );
    if (this.e === 0) {
      module._free(this.romPtr);
      throw new Error("binjgb rejected the ROM");
    }
    // Without the default joypad callback installed, the emulator never
    // reads the state the _set_joyp_* setters write and input is dead.
    this.joypadPtr = module._joypad_new();
    module._emulator_set_default_joypad_callback(this.e, this.joypadPtr);
  }

  private heap(ptr: number, size: number): Uint8Array {
    return new Uint8Array(this.module.HEAP8.buffer, ptr, size);
  }

  get ticks(): number {
    return this.module._emulator_get_ticks_f64(this.e);
  }

  /** Run until `untilTicks`, reporting each frame/audio event as it happens. */
  runUntil(untilTicks: number, onEvent?: (event: number) => void): void {
    for (;;) {
      const event = this.module._emulator_run_until_f64(this.e, untilTicks);
      onEvent?.(event);
      if (event & EVENT_UNTIL_TICKS) return;
    }
  }

  /** True when the game wrote to cartridge RAM since the last call. */
  takeExtRamUpdated(): boolean {
    return !!this.module._emulator_was_ext_ram_updated(this.e);
  }

  /**
   * Inject battery RAM. Returns false (and leaves the emulator untouched)
   * when the byte length does not match the cartridge's ext-RAM size.
   */
  loadExtRam(bytes: Uint8Array): boolean {
    return this.withExtRamFileData((fileDataPtr, buffer) => {
      if (buffer.length !== bytes.length) return false;
      buffer.set(bytes);
      this.module._emulator_read_ext_ram(this.e, fileDataPtr);
      return true;
    });
  }

  /** Copy of the emulator's current battery RAM. */
  readExtRam(): Uint8Array {
    return this.withExtRamFileData((fileDataPtr, buffer) => {
      this.module._emulator_write_ext_ram(this.e, fileDataPtr);
      return Uint8Array.from(buffer);
    });
  }

  private withExtRamFileData<T>(cb: (fileDataPtr: number, buffer: Uint8Array) => T): T {
    const fileDataPtr = this.module._ext_ram_file_data_new(this.e);
    try {
      const buffer = this.heap(
        this.module._get_file_data_ptr(fileDataPtr),
        this.module._get_file_data_size(fileDataPtr),
      );
      return cb(fileDataPtr, buffer);
    } finally {
      this.module._file_data_delete(fileDataPtr);
    }
  }

  /** RGBA8888 view of the current frame (160×144×4 bytes). */
  frameBuffer(): Uint8Array {
    return this.heap(
      this.module._get_frame_buffer_ptr(this.e),
      this.module._get_frame_buffer_size(this.e),
    );
  }

  /** Interleaved stereo u8 sample view; length = audioFrames × 2. */
  audioBuffer(): Uint8Array {
    return this.heap(
      this.module._get_audio_buffer_ptr(this.e),
      this.module._get_audio_buffer_capacity(this.e),
    );
  }

  setButton(button: JoypadButton, pressed: boolean): void {
    const m = this.module;
    const e = this.e;
    switch (button) {
      case "up":
        return m._set_joyp_up(e, pressed);
      case "down":
        return m._set_joyp_down(e, pressed);
      case "left":
        return m._set_joyp_left(e, pressed);
      case "right":
        return m._set_joyp_right(e, pressed);
      case "select":
        return m._set_joyp_select(e, pressed);
      case "start":
        return m._set_joyp_start(e, pressed);
      case "b":
        return m._set_joyp_B(e, pressed);
      case "a":
        return m._set_joyp_A(e, pressed);
    }
  }

  delete(): void {
    if (this.deleted) return;
    this.deleted = true;
    this.module._joypad_delete(this.joypadPtr);
    this.module._emulator_delete(this.e);
    this.module._free(this.romPtr);
  }
}
