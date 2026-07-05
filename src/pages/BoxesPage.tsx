import { useRef, useState } from "react";
import { createMon, recalcDerivedFields } from "../save/derive";
import { DEX_SPECIES, speciesByInternalId } from "../save/gamedata";
import { MONS_PER_BOX, NUM_BOXES } from "../save/layout";
import type { MonRecord } from "../save/pokemon";
import {
  getCurrentBoxIndex,
  getOwnOtName,
  getPlayerId,
  readBox,
  removeBoxMon,
  reorderBoxMon,
  switchCurrentBox,
  writeBoxMon,
  type MonNames,
} from "../save/savefile";
import { fillLivingDex } from "../save/livingdex";
import { exportPk1, importPk1 } from "../save/pk1";
import { useSaveStore } from "../state/store";
import { Badge, Button } from "../components/ui/ui";
import { EmptyLine } from "../components/EmptyLine";
import { MonEditor, type MonEditorTab } from "../components/MonEditor";
import { PageHeader } from "../components/PageHeader";
import { ReorderControls } from "../components/ReorderControls";
import { Sprite } from "../components/Sprite";
import { useDragReorder } from "../components/useDragReorder";

const BULBASAUR = DEX_SPECIES[0]?.internalId ?? 0x99;

export function BoxesPage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const current = getCurrentBoxIndex(bytes);
  const [box, setBox] = useState(current);
  const [dexNotice, setDexNotice] = useState<string | null>(null);

  function fillDex() {
    let result = { added: 0, skippedForSpace: 0 };
    mutate((b) => {
      result = fillLivingDex(b, getOwnOtName(b));
    });
    setDexNotice(
      result.added === 0 && result.skippedForSpace > 0
        ? `No space left in the boxes — ${result.skippedForSpace} species could not be added.`
        : result.added === 0
          ? "Nothing to add — every species is already in this save."
          : `Added ${result.added} species at Lv5 in dex order${
              result.skippedForSpace ? `; ${result.skippedForSpace} did not fit` : ""
            }. Undo (Ctrl/⌘Z) reverts the whole fill.`,
    );
  }
  const [slot, setSlot] = useState(0);
  const [tab, setTab] = useState<MonEditorTab>("summary");
  const [pk1Error, setPk1Error] = useState<string | null>(null);
  const pk1InputRef = useRef<HTMLInputElement>(null);
  // Live view of the selected box, for async work that outlives a box switch.
  const boxRef = useRef(box);
  boxRef.current = box;

  const contents = readBox(bytes, box);
  const active = contents.mons[slot];

  function exportActivePk1() {
    if (!active) return;
    // Box records carry no derived stats; fill them for the party-format file.
    const mon = structuredClone(active.mon);
    mon.level = mon.boxLevel;
    // recalcDerivedFields treats a record without maxHp as fully healed;
    // keep the real current HP so injured box mons export as-is.
    const currentHp = mon.currentHp;
    recalcDerivedFields(mon);
    mon.currentHp = Math.min(currentHp, mon.maxHp ?? currentHp);
    const name = active.nickname || speciesByInternalId(mon.species)?.name || "mon";
    const data = exportPk1(mon, { nickname: active.nickname, otName: active.otName });
    const url = URL.createObjectURL(new Blob([data], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.toLowerCase()}.pk1`;
    // Attached to the DOM for the click: some browsers ignore detached anchors.
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Deferred so slower browsers finish initiating the download first.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importPk1File(file: File) {
    // Import into the box the user was viewing when they picked the file,
    // even if they switch boxes while it is being read.
    const targetBox = box;
    try {
      const { mon, names } = importPk1(new Uint8Array(await file.arrayBuffer()));
      const nickname = names.nickname.trim() || speciesByInternalId(mon.species)?.name || "MON";
      const otName = names.otName.trim() || "TRAINER";
      let placed = -1;
      mutate((b) => {
        const count = readBox(b, targetBox).mons.length;
        if (count >= MONS_PER_BOX) return; // no-op mutate
        writeBoxMon(b, targetBox, count, mon, { nickname, otName });
        placed = count;
      });
      if (placed < 0) {
        setPk1Error(`Box ${targetBox + 1} is already full.`);
        return;
      }
      // Only move the selection if the user is still looking at that box.
      if (boxRef.current === targetBox) setSlot(placed);
      setPk1Error(null);
    } catch (e) {
      setPk1Error(e instanceof Error ? e.message : String(e));
    }
  }

  function commit(index: number, mon: MonRecord, names: MonNames) {
    const nickname = names.nickname.trim() || speciesByInternalId(mon.species)?.name || "";
    mutate((b) => writeBoxMon(b, box, index, mon, { ...names, nickname }));
  }

  function addMon() {
    if (contents.mons.length >= MONS_PER_BOX) return;
    const index = contents.mons.length;
    const mon = createMon(BULBASAUR, 5);
    // Your own ID, so the game treats it as caught (normal EXP, obedient).
    mon.otId = getPlayerId(bytes);
    mutate((b) =>
      writeBoxMon(b, box, index, mon, {
        nickname: speciesByInternalId(BULBASAUR)?.name ?? "",
        otName: getOwnOtName(bytes),
      }),
    );
    setSlot(index);
  }

  function remove(index: number) {
    mutate((b) => removeBoxMon(b, box, index));
    setSlot((s) => Math.max(0, Math.min(s, contents.mons.length - 2)));
  }

  function reorder(from: number, to: number) {
    mutate((b) => reorderBoxMon(b, box, from, to));
    setSlot((s) => (s === from ? to : s > from && s <= to ? s - 1 : s < from && s >= to ? s + 1 : s));
  }

  const drag = useDragReorder(reorder, contents.mons.length);

  return (
    <div className="page">
      <PageHeader
        title="Boxes"
        subtitle="12 storage boxes of 20. The current box is mirrored in the bank-1 cache; edits here keep both in sync."
        actions={
          <Button size="sm" onClick={fillDex} data-testid="fill-living-dex">
            Fill living dex
          </Button>
        }
      />
      <input
        ref={pk1InputRef}
        data-testid="box-pk1-input"
        type="file"
        accept=".pk1,.bin"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importPk1File(f);
          e.target.value = "";
        }}
      />
      {pk1Error && (
        <p className="hint-line hint-line--warn" data-testid="box-pk1-error" role="alert">
          Import failed: {pk1Error}
        </p>
      )}
      {dexNotice && (
        <p className="hint-line" data-testid="living-dex-notice" role="status">
          {dexNotice}
        </p>
      )}

      <div className="box-tabs" role="tablist" aria-label="Boxes">
        {Array.from({ length: NUM_BOXES }, (_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={box === i}
            className={`box-tab ${box === i ? "box-tab--active" : ""}`}
            onClick={() => {
              setBox(i);
              setSlot(0);
            }}
          >
            {i + 1}
            {i === current && <span className="box-tab__dot" title="Current box" />}
          </button>
        ))}
      </div>

      <div className="detail-layout detail-layout--wide">
        <div className="box-panel">
          <div className="box-panel__head">
            <span>
              Box {box + 1} {box === current && <Badge tone="primary">Current</Badge>}
            </span>
            <span className="box-panel__head-actions">
              {box !== current && (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Persist the current box to storage and make this one active, like the in-game PC"
                  onClick={() => mutate((b) => switchCurrentBox(b, box))}
                >
                  Set as current
                </Button>
              )}
              <span className="mono muted">
                {contents.mons.length} / {MONS_PER_BOX}
              </span>
            </span>
          </div>
          {contents.mons.length === 0 ? (
            <EmptyLine
              title="Empty box"
              body={
                contents.initialized
                  ? "No Pokémon stored here."
                  : "The game hasn't used this box yet (raw uninitialized data); it will be set up properly on the first write."
              }
              action={
                <>
                  <Button variant="primary" size="sm" onClick={addMon}>
                    Add Pokémon
                  </Button>
                  <Button size="sm" onClick={() => pk1InputRef.current?.click()}>
                    Import .pk1
                  </Button>
                </>
              }
            />
          ) : (
            <>
              <div className="box-grid">
                {contents.mons.map((m, i) => {
                  const sp = speciesByInternalId(m.mon.species);
                  return (
                    <div key={i} className={`box-cell ${i === slot ? "box-cell--active" : ""}`} {...drag.rowProps(i)}>
                      <button
                        type="button"
                        className="box-cell__btn"
                        title={`${m.nickname || sp?.name} · Lv${m.mon.level}`}
                        onClick={() => setSlot(i)}
                      >
                        <Sprite dexNo={sp?.dexNo ?? 0} size={44} alt={sp?.name ?? ""} />
                        <span className="box-cell__lv mono">Lv{m.mon.level}</span>
                      </button>
                      <ReorderControls
                        index={i}
                        count={contents.mons.length}
                        label={m.nickname || sp?.name || "Pokémon"}
                        gripProps={drag.gripProps(i)}
                        onMove={(d) => drag.moveBy(i, d)}
                        vertical={false}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="box-panel__foot">
                <Button
                  variant="default"
                  size="sm"
                  onClick={addMon}
                  disabled={contents.mons.length >= MONS_PER_BOX}
                >
                  Add Pokémon
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => pk1InputRef.current?.click()}
                  disabled={contents.mons.length >= MONS_PER_BOX}
                >
                  Import .pk1
                </Button>
              </div>
            </>
          )}
        </div>

        {active && (
          <div className="detail-main">
            <div className="detail-main__toolbar">
              <span className="detail-main__title">
                Box {box + 1} · Slot {slot + 1}
              </span>
              <Button size="sm" variant="ghost" onClick={exportActivePk1} data-testid="box-pk1-export">
                Export .pk1
              </Button>
              <Button variant="danger" size="sm" onClick={() => remove(slot)}>
                Remove
              </Button>
            </div>
            <MonEditor
              mon={active.mon}
              names={{ nickname: active.nickname, otName: active.otName }}
              tab={tab}
              onTab={setTab}
              onChange={(mon, names) => commit(slot, mon, names)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
