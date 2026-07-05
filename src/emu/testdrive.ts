import {
  BinjgbCore,
  CPU_TICKS_PER_SECOND,
  EVENT_AUDIO_BUFFER_FULL,
  EVENT_NEW_FRAME,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from "./binjgb/core";
import type { JoypadButton } from "./binjgb/core";

export type GbButton = JoypadButton;

/** Matches the help text on the Test Drive page. */
const KEY_TO_BUTTON: Record<string, GbButton> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyX: "a",
  KeyZ: "b",
  Enter: "start",
  ShiftRight: "select",
};

const AUDIO_FRAMES = 4096;
const AUDIO_LATENCY_SEC = 0.1;
const AUDIO_VOLUME = 0.5;
/** Max emulated time per animation frame (== 5 frames), as in binjgb's demo. */
const MAX_UPDATE_SEC = 5 / 60;
/** Rate limit for onSramWrite; Gen 1 writes SRAM scratch nearly every frame. */
const SRAM_NOTIFY_MS = 500;

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
   * Called (throttled to ~500 ms) while the game writes cartridge RAM, with
   * a copy of the current 32 KiB SRAM. Note Gen 1 also uses SRAM bank 0 as
   * sprite scratch, so a callback does not imply an in-game save — filter
   * with mainSaveRegionChanged.
   */
  onSramWrite?: (sram: Uint8Array) => void;
}

/**
 * Boot a ROM with the edited save injected as cartridge SRAM, on the binjgb
 * wasm core. The returned handle drives one requestAnimationFrame loop;
 * callers must stop() the previous drive before starting a new one.
 */
export async function startTestDrive({
  rom,
  save,
  canvas,
  sound,
  onSramWrite,
}: TestDriveOptions): Promise<TestDrive> {
  // Created on the boot click, so autoplay policies allow it to start. The
  // first boot awaits the code-split wasm load before reaching this point,
  // which can outlive the click activation on some browsers — resume() then
  // and on later pushes until the context actually runs.
  const audioCtx = sound ? new AudioContext() : null;
  if (audioCtx?.state === "suspended") void audioCtx.resume().catch(() => {});
  const core = await BinjgbCore.create(rom, {
    sampleRate: audioCtx?.sampleRate ?? 44100,
    audioFrames: AUDIO_FRAMES,
  });

  if (!core.loadExtRam(save)) {
    // Cartridge ext-RAM size differs from a Gen 1 battery save; the game
    // will boot to NEW GAME instead of the injected state.
    console.warn("testdrive: save size does not match the cartridge ext-RAM; booting without it");
  }

  const ctx = canvas.getContext("2d");
  const imageData = ctx?.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT) ?? null;

  let rafId = 0;
  let lastRafSec = 0;
  let leftoverTicks = 0;
  let audioStartSec = 0;
  let sramDirty = false;
  let lastSramNotify = 0;
  let stopped = false;

  function pushAudio() {
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      // Nothing would be heard; retry activation instead of queueing audio.
      void audioCtx.resume().catch(() => {});
      return;
    }
    const nowSec = audioCtx.currentTime;
    audioStartSec ||= nowSec + AUDIO_LATENCY_SEC;
    if (audioStartSec < nowSec) {
      // Fell behind (tab hidden etc.) — resync instead of queueing stale audio.
      audioStartSec = nowSec + AUDIO_LATENCY_SEC;
    }
    const samples = core.audioBuffer();
    const buffer = audioCtx.createBuffer(2, AUDIO_FRAMES, audioCtx.sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let i = 0; i < AUDIO_FRAMES; i++) {
      left[i] = (samples[2 * i] * AUDIO_VOLUME) / 255;
      right[i] = (samples[2 * i + 1] * AUDIO_VOLUME) / 255;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(audioStartSec);
    audioStartSec += AUDIO_FRAMES / audioCtx.sampleRate;
  }

  function onFrame(nowMs: number) {
    rafId = requestAnimationFrame(onFrame);
    const nowSec = nowMs / 1000;
    const deltaSec = Math.min(Math.max(nowSec - (lastRafSec || nowSec), 0), MAX_UPDATE_SEC);
    lastRafSec = nowSec;

    const untilTicks = core.ticks + deltaSec * CPU_TICKS_PER_SECOND - leftoverTicks;
    let newFrame = false;
    core.runUntil(untilTicks, (event) => {
      if (event & EVENT_NEW_FRAME) newFrame = true;
      if (event & EVENT_AUDIO_BUFFER_FULL) pushAudio();
    });
    leftoverTicks = core.ticks - untilTicks;

    if (newFrame && ctx && imageData) {
      imageData.data.set(core.frameBuffer());
      ctx.putImageData(imageData, 0, 0);
    }

    if (onSramWrite) {
      sramDirty ||= core.takeExtRamUpdated();
      if (sramDirty && nowMs - lastSramNotify >= SRAM_NOTIFY_MS) {
        sramDirty = false;
        lastSramNotify = nowMs;
        onSramWrite(core.readExtRam());
      }
    }
  }

  function onKey(e: KeyboardEvent) {
    const button = KEY_TO_BUTTON[e.code];
    if (!button) return;
    // Don't steal keys from form fields (e.g. editing while the game runs).
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    // Consumed by the game: keep Enter from activating a focused page
    // button (restart/stop) and arrows from scrolling.
    e.preventDefault();
    core.setButton(button, e.type === "keydown");
  }

  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  rafId = requestAnimationFrame(onFrame);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      // The glue's button state is module-global: a button still held here
      // would carry into the next booted core as an eternal press.
      for (const button of Object.values(KEY_TO_BUTTON)) core.setButton(button, false);
      void audioCtx?.close().catch(() => {});
      core.delete();
    },
    setButton: (button, pressed) => {
      if (!stopped) core.setButton(button, pressed);
    },
    readSram: () => {
      if (stopped) return null;
      const sram = core.readExtRam();
      // A warned-but-bootable cartridge can have a different ext-RAM size;
      // that is not a Gen 1 battery save, so don't offer it to the editor.
      return sram.length === 0x8000 ? sram : null;
    },
  };
}
