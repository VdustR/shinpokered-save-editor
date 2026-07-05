import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Panel, Toggle } from "../components/ui/ui";
import { assessRom, type RomAssessment } from "../emu/rom";
import { clearRom, loadRom, saveRom, type StoredRom } from "../emu/romstore";
import type { TestDrive } from "../emu/testdrive";
import { exportSave, parseSave } from "../save/savefile";
import { useSaveStore } from "../state/store";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const driveRef = useRef<TestDrive | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Bumped on every stop/boot so a boot that was superseded while awaiting
  // the code-split emulator import bails out instead of double-starting.
  const bootIdRef = useRef(0);

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
    driveRef.current = startTestDrive({ rom: rom.bytes, save, canvas: canvasRef.current, sound });
    setRunning(true);
    setNotice(null);
    canvasRef.current.focus();
  }

  function pullSave() {
    const sram = driveRef.current?.readSram();
    if (!sram) return;
    const { warnings } = parseSave(sram);
    mutate((b) => b.set(sram));
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
            Shin’s title menu runs a hardware-accuracy self-check; this lightweight browser core fails
            its mode-3 VRAM test, so “Emulator ERROR!” may appear there. It is informational — the game
            plays on.
          </p>
          <dl className="testdrive__keys">
            {KEYS.map(([key, label]) => (
              <div key={key} className="testdrive__key">
                <dt className="mono">{key}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
          {notice && (
            <p className="hint-line" data-testid="testdrive-notice">
              {notice}
            </p>
          )}
        </Panel>

        <Panel title="Screen" className="span-2">
          <div className={`testdrive__stage ${running ? "testdrive__stage--on" : ""}`}>
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
        </Panel>
      </div>
    </div>
  );
}
