import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { VirtualPad } from "../components/VirtualPad";
import { Badge, Button, Panel, Toggle } from "../components/ui/ui";
import { assessRom, type RomAssessment } from "../emu/rom";
import { clearRom, loadRom, saveRom, type StoredRom } from "../emu/romstore";
import { mainSaveRegionChanged } from "../emu/saveback";
import type { GbButton, TestDrive } from "../emu/testdrive";
import { exportSave, parseSave } from "../save/savefile";
import { useSaveStore } from "../state/store";

/**
 * Touch capability, not device class: coarse pointers and touch points cover
 * phones/tablets without user-agent sniffing, and the pad stays available as
 * a manual toggle for everything else (touch laptops, pen displays).
 */
function detectTouch(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

const KEYS = [
  ["Arrows", "D-pad"],
  ["X", "A"],
  ["Z", "B"],
  ["Enter", "Start"],
  ["Right Shift", "Select"],
] as const;

export function TestDrivePage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const original = useSaveStore((s) => s.original);
  const mutate = useSaveStore((s) => s.mutate);

  const [rom, setRom] = useState<StoredRom | null>(null);
  const [romLoaded, setRomLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [padOn, setPadOn] = useState(detectTouch);
  const [saveDetected, setSaveDetected] = useState(false);
  /** SRAM as last injected or pulled; the baseline for save detection. */
  const baselineRef = useRef<Uint8Array | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  /** True when the Fullscreen API is unavailable and a fixed overlay fills in. */
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const driveRef = useRef<TestDrive | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Bumped on every stop/boot so a boot that was superseded while awaiting
  // the code-split emulator import bails out instead of double-starting.
  const bootIdRef = useRef(0);

  // Track native fullscreen changes (Esc, system UI) and lock page scroll
  // while the CSS-overlay fallback is active.
  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === stageRef.current && stageRef.current !== null);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!cssFullscreen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    // Match native fullscreen: Escape leaves the overlay fallback too.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCssFullscreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [cssFullscreen]);

  useEffect(() => {
    let cancelled = false;
    loadRom()
      .then((r) => {
        if (!cancelled) setRom(r);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRomLoaded(true);
      });
    return () => {
      cancelled = true;
      // Also invalidates an in-flight boot() still awaiting the wasm core,
      // so its continuation bails instead of running a loop on a dead page.
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- counter ref, not a DOM node; the latest value is the point
      bootIdRef.current++;
      driveRef.current?.stop();
      driveRef.current = null;
    };
  }, []);

  // While the emulator runs, keep arrow/space keys from scrolling the page.
  useEffect(() => {
    if (!running) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName))
        return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [running]);

  const assessment: RomAssessment | null = useMemo(() => (rom ? assessRom(rom.bytes) : null), [rom]);
  const bootable = assessment !== null && assessment.verdict !== "invalid";

  async function pickRom(file: File) {
    // Invalidates any in-flight boot so it cannot start with the old ROM.
    stopDrive();
    const data = new Uint8Array(await file.arrayBuffer());
    const a = assessRom(data);
    if (a.verdict === "invalid") {
      setRom({ name: file.name, bytes: data });
      setNotice(null);
      return; // shown as invalid; not persisted
    }
    await saveRom(file.name, data).catch(() => {});
    setRom({ name: file.name, bytes: data });
    setNotice(null);
  }

  async function toggleFullscreen() {
    if (fullscreen || cssFullscreen) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setCssFullscreen(false);
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    // iPhone Safari has no element fullscreen; fall back to a fixed overlay.
    if (stage.requestFullscreen) {
      try {
        await stage.requestFullscreen();
        return;
      } catch {
        // fall through to the CSS overlay
      }
    }
    setCssFullscreen(true);
  }

  function stopDrive() {
    bootIdRef.current++;
    driveRef.current?.stop();
    driveRef.current = null;
    setRunning(false);
  }

  async function boot() {
    if (!rom || !canvasRef.current) return;
    stopDrive();
    const myBootId = bootIdRef.current;
    // The emulator core is code-split; it loads on first boot only.
    const { startTestDrive } = await import("../emu/testdrive");
    if (myBootId !== bootIdRef.current || !canvasRef.current) return;
    // Boot with export-quality bytes so in-game checksum validation passes.
    const save = exportSave(bytes, original ?? undefined);
    baselineRef.current = Uint8Array.from(save);
    setSaveDetected(false);
    const drive = await startTestDrive({
      rom: rom.bytes,
      save,
      canvas: canvasRef.current,
      sound,
      onSramWrite: (sram) => {
        // A stopped session's throttled callback may still fire; ignore it.
        if (myBootId !== bootIdRef.current) return;
        // Bank-0 sprite scratch fires this constantly; only a rewrite of the
        // bank-1 main region means the player used SAVE in-game.
        if (baselineRef.current && mainSaveRegionChanged(baselineRef.current, sram)) {
          setSaveDetected(true);
        }
      },
    });
    if (myBootId !== bootIdRef.current) {
      // Superseded while the wasm core was loading; don't leak the run loop.
      drive.stop();
      return;
    }
    driveRef.current = drive;
    setRunning(true);
    setNotice(null);
    canvasRef.current.focus();
  }

  function ignoreDetectedSave() {
    // Adopt the current SRAM as the new baseline; otherwise the very next
    // debounced scratch write would re-flag the same in-game save.
    const sram = driveRef.current?.readSram();
    if (sram) baselineRef.current = sram;
    setSaveDetected(false);
  }

  function pullSave() {
    const sram = driveRef.current?.readSram();
    if (!sram) return;
    const { warnings } = parseSave(sram);
    mutate((b) => b.set(sram));
    baselineRef.current = Uint8Array.from(sram);
    setSaveDetected(false);
    setNotice(
      warnings.length
        ? `Pulled the emulator save into the editor with warnings: ${warnings.join("; ")}`
        : "Pulled the emulator save into the editor. Undo (Ctrl/⌘Z) restores the previous state.",
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Test Drive"
        subtitle="Boot your ROM with the edited save injected — verify changes without leaving the browser."
      />

      <div className="page__grid">
        <Panel title="ROM">
          <p className="hint-line">
            Pick your own ROM file (.gb). It is stored only in this browser (IndexedDB) and never uploaded.
          </p>
          <input
            ref={fileRef}
            data-testid="rom-input"
            type="file"
            accept=".gb,.gbc,.bin"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickRom(f);
              e.target.value = "";
            }}
          />
          <div className="testdrive__romrow">
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              {rom ? "Replace ROM…" : "Choose ROM…"}
            </Button>
            {rom && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  stopDrive();
                  void clearRom().catch(() => {});
                  setRom(null);
                }}
              >
                Forget ROM
              </Button>
            )}
          </div>
          {!romLoaded && <p className="hint-line">Checking for a stored ROM…</p>}
          {rom && assessment && (
            <div className="testdrive__rominfo" data-testid="rom-info">
              <span className="mono">{rom.name}</span>
              <span className="mono">{(rom.bytes.length / 1024).toLocaleString()} KiB</span>
              {assessment.info.title && <span className="mono">“{assessment.info.title}”</span>}
              <span className="mono">{assessment.info.cartridgeTypeName}</span>
              <Badge
                tone={
                  assessment.verdict === "ok"
                    ? "success"
                    : assessment.verdict === "warn"
                      ? "warning"
                      : "danger"
                }
              >
                {assessment.verdict === "ok"
                  ? "Looks bootable"
                  : assessment.verdict === "warn"
                    ? "Bootable with warnings"
                    : "Not a GB ROM"}
              </Badge>
            </div>
          )}
          {assessment?.reasons.map((r) => (
            <p key={r} className="hint-line hint-line--warn">
              {r}
            </p>
          ))}
        </Panel>

        <Panel title="Controls">
          <div className="testdrive__actions">
            <Button variant="primary" disabled={!bootable} onClick={() => void boot()} data-testid="boot-button">
              {running ? "Restart with current edits" : "Boot with current edits"}
            </Button>
            <Button disabled={!running} onClick={stopDrive}>
              Stop
            </Button>
            <Button disabled={!running} onClick={pullSave} data-testid="pull-save">
              Pull save into editor
            </Button>
            <Toggle
              checked={padOn}
              label="Virtual gamepad"
              onChange={setPadOn}
            />
            <Toggle
              checked={sound}
              label="Sound"
              onChange={(v) => {
                setSound(v);
                if (running) setNotice("Sound setting applies on the next boot.");
              }}
            />
          </div>
          <p className="hint-line">
            Booting uses a checksum-repaired copy of your edits; the working buffer is untouched. “Pull
            save” copies the emulator’s battery save back into the editor as one undoable edit — save
            in-game first (START → SAVE).
          </p>
          <p className="hint-line">
            Shin’s title menu runs hardware-accuracy self-checks; this lightweight browser core fails
            the mode-3 VRAM and memory-timing tests, so up to two “Emulator ERROR!” lines may appear
            there. Per the romhack’s FAQ they are informational — the game plays and saves normally.
          </p>
          <dl className="testdrive__keys">
            {KEYS.map(([key, label]) => (
              <div key={key} className="testdrive__key">
                <dt className="mono">{key}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
          {running && saveDetected && (
            <p className="save-detected" data-testid="save-detected" role="status">
              The game saved. Pull it into the editor?
              <Button size="sm" variant="primary" onClick={pullSave}>
                Pull save
              </Button>
              <Button size="sm" variant="ghost" onClick={ignoreDetectedSave}>
                Ignore
              </Button>
            </p>
          )}
          {notice && (
            <p className="hint-line" data-testid="testdrive-notice">
              {notice}
            </p>
          )}
        </Panel>

        <Panel
          title="Screen"
          className="span-2"
          actions={
            <Button size="sm" variant="ghost" onClick={() => void toggleFullscreen()} data-testid="fullscreen-toggle">
              {fullscreen || cssFullscreen ? "Exit full screen" : "Full screen"}
            </Button>
          }
        >
          <div
            ref={stageRef}
            className={`testdrive__stage ${running ? "testdrive__stage--on" : ""} ${
              cssFullscreen ? "testdrive__stage--overlay" : ""
            }`}
            data-testid="stage"
          >
            <div className="testdrive__screenbox">
              <canvas
                ref={canvasRef}
                data-testid="gb-canvas"
                width={160}
                height={144}
                tabIndex={-1}
                aria-label="Game Boy screen"
              />
              {!running && <span className="testdrive__stage-hint">Screen off — boot to start playing.</span>}
            </div>
            {(fullscreen || cssFullscreen) && (
              <button
                type="button"
                className="testdrive__exit-fs"
                onClick={() => void toggleFullscreen()}
                aria-label="Exit full screen"
              >
                ✕
              </button>
            )}
            {padOn && <VirtualPad onButton={(b: GbButton, pressed) => driveRef.current?.setButton(b, pressed)} />}
          </div>
        </Panel>
      </div>
    </div>
  );
}
