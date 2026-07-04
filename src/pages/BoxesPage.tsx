import { useState } from "react";
import { createMon } from "../save/derive";
import { DEX_SPECIES, speciesByInternalId } from "../save/gamedata";
import { MONS_PER_BOX, NUM_BOXES } from "../save/layout";
import type { MonRecord } from "../save/pokemon";
import {
  getCurrentBoxIndex,
  readBox,
  removeBoxMon,
  writeBoxMon,
  type MonNames,
} from "../save/savefile";
import { useSaveStore } from "../state/store";
import { Badge, Button } from "../components/ui/ui";
import { EmptyLine } from "../components/EmptyLine";
import { MonEditor } from "../components/MonEditor";
import { PageHeader } from "../components/PageHeader";
import { Sprite } from "../components/Sprite";

const BULBASAUR = DEX_SPECIES[0]?.internalId ?? 0x99;

export function BoxesPage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const current = getCurrentBoxIndex(bytes);
  const [box, setBox] = useState(current);
  const [slot, setSlot] = useState(0);
  const [tab, setTab] = useState<"summary" | "moves" | "dvs">("summary");

  const contents = readBox(bytes, box);
  const active = contents.mons[slot];

  function commit(index: number, mon: MonRecord, names: MonNames) {
    const nickname = names.nickname.trim() || speciesByInternalId(mon.species)?.name || "";
    mutate((b) => writeBoxMon(b, box, index, mon, { ...names, nickname }));
  }

  function addMon() {
    if (contents.mons.length >= MONS_PER_BOX) return;
    const index = contents.mons.length;
    const mon = createMon(BULBASAUR, 5);
    mutate((b) => writeBoxMon(b, box, index, mon, { nickname: speciesByInternalId(BULBASAUR)?.name ?? "", otName: "RED" }));
    setSlot(index);
  }

  function remove(index: number) {
    mutate((b) => removeBoxMon(b, box, index));
    setSlot((s) => Math.max(0, Math.min(s, contents.mons.length - 2)));
  }

  return (
    <div className="page">
      <PageHeader
        title="Boxes"
        subtitle="12 storage boxes of 20. The current box is mirrored in the bank-1 cache; edits here keep both in sync."
      />

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
            <span className="mono muted">
              {contents.mons.length} / {MONS_PER_BOX}
            </span>
          </div>
          {contents.mons.length === 0 ? (
            <EmptyLine
              title="Empty box"
              body="No Pokémon stored here."
              action={<Button variant="primary" size="sm" onClick={addMon}>Add Pokémon</Button>}
            />
          ) : (
            <>
              <div className="box-grid">
                {contents.mons.map((m, i) => {
                  const sp = speciesByInternalId(m.mon.species);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`box-cell ${i === slot ? "box-cell--active" : ""}`}
                      title={`${m.nickname || sp?.name} · Lv${m.mon.level}`}
                      onClick={() => setSlot(i)}
                    >
                      <Sprite dexNo={sp?.dexNo ?? 0} size={44} alt={sp?.name ?? ""} />
                      <span className="box-cell__lv mono">Lv{m.mon.level}</span>
                    </button>
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
