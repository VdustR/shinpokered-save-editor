import { useRef, useState } from "react";
import { createMon } from "../save/derive";
import { DEX_SPECIES, speciesByInternalId } from "../save/gamedata";
import type { MonRecord } from "../save/pokemon";
import {
  clearDayCare,
  getDayCare,
  getParty,
  getPlayerName,
  removePartyMon,
  reorderParty,
  setDayCareMon,
  setPartyMon,
  type MonNames,
} from "../save/savefile";
import { OFFSETS, PARTY_LENGTH } from "../save/layout";
import { useNav } from "../state/nav";
import { useSaveStore } from "../state/store";
import { Button, OffsetChip, Panel } from "../components/ui/ui";
import { EmptyLine } from "../components/EmptyLine";
import { MonEditor, type MonEditorTab } from "../components/MonEditor";
import { PageHeader } from "../components/PageHeader";
import { ReorderControls } from "../components/ReorderControls";
import { Sprite } from "../components/Sprite";
import { useDragReorder } from "../components/useDragReorder";
import { TeamCoverage } from "../components/TeamCoverage";
import { healParty } from "../save/team";
import { exportPk1, importPk1 } from "../save/pk1";
import { recalcDerivedFields } from "../save/derive";
import { legalityReport } from "../save/report";

const BULBASAUR = DEX_SPECIES[0]?.internalId ?? 0x99;

export function PartyPage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<MonEditorTab>("summary");
  const [importError, setImportError] = useState<string | null>(null);
  const pk1InputRef = useRef<HTMLInputElement>(null);

  const party = getParty(bytes);
  const active = party[selected];

  function commit(index: number, mon: MonRecord, names: MonNames) {
    // Gen 1 never stores a blank nickname; a non-nicknamed mon carries its
    // species name. Default an empty field to that instead of writing blanks.
    const nickname = names.nickname.trim() || speciesByInternalId(mon.species)?.name || "";
    mutate((b) => setPartyMon(b, index, mon, { ...names, nickname }));
  }

  function addMon() {
    if (party.length >= PARTY_LENGTH) return;
    const mon = createMon(BULBASAUR, 5);
    const index = party.length;
    mutate((b) => setPartyMon(b, index, mon, { nickname: speciesByInternalId(BULBASAUR)?.name ?? "", otName: "RED" }));
    setSelected(index);
  }

  function remove(index: number) {
    mutate((b) => removePartyMon(b, index));
    setSelected((s) => Math.max(0, Math.min(s, party.length - 2)));
  }

  function reorder(from: number, to: number) {
    mutate((b) => reorderParty(b, from, to));
    // Keep the same mon selected as it moves.
    setSelected((s) => (s === from ? to : s > from && s <= to ? s - 1 : s < from && s >= to ? s + 1 : s));
  }

  const drag = useDragReorder(reorder, party.length);

  function exportActivePk1() {
    if (!active) return;
    const name = active.nickname || speciesByInternalId(active.mon.species)?.name || "mon";
    const data = exportPk1(active.mon, { nickname: active.nickname, otName: active.otName });
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
    try {
      const { mon, names } = importPk1(new Uint8Array(await file.arrayBuffer()));
      // Fill derived fields for the party format and default blank names.
      recalcDerivedFields(mon);
      const nickname = names.nickname.trim() || speciesByInternalId(mon.species)?.name || "MON";
      const otName = names.otName.trim() || "TRAINER";
      // The party may have changed while the file was being read, so pick the
      // slot from the live buffer inside the mutation, not from render state.
      let placed = -1;
      mutate((b) => {
        const count = getParty(b).length;
        if (count >= PARTY_LENGTH) return; // leaves the buffer untouched (no-op)
        setPartyMon(b, count, mon, { nickname, otName });
        placed = count;
      });
      if (placed < 0) {
        setImportError("The party is already full.");
        return;
      }
      setSelected(placed);
      setImportError(null);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Party"
        subtitle="Up to six Pokémon. Editing level, DVs, or stat EXP recalculates stats automatically."
        actions={
          <>
            <input
              ref={pk1InputRef}
              data-testid="pk1-input"
              type="file"
              accept=".pk1,.bin"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importPk1File(f);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              onClick={() => pk1InputRef.current?.click()}
              disabled={party.length >= PARTY_LENGTH}
            >
              Import .pk1
            </Button>
            <Button
              size="sm"
              onClick={() => mutate(healParty)}
              disabled={party.length === 0}
              data-testid="heal-team"
            >
              Heal team
            </Button>
            <Button variant="primary" size="sm" onClick={addMon} disabled={party.length >= PARTY_LENGTH}>
              Add Pokémon
            </Button>
          </>
        }
      />

      {importError && (
        <p className="hint-line hint-line--warn" data-testid="pk1-error" role="alert">
          Import failed: {importError}
        </p>
      )}

      {party.length === 0 ? (
        <EmptyLine
          title="Empty party"
          body="This save has no Pokémon in the party. Add one to start editing, or import from a box."
          action={<Button variant="primary" onClick={addMon}>Add Pokémon</Button>}
        />
      ) : (
        <div className="detail-layout">
          <aside className="slot-list" aria-label="Party slots">
            {party.map((slot, i) => {
              const sp = speciesByInternalId(slot.mon.species);
              const findings = legalityReport(slot.mon, { nickname: slot.nickname, otName: slot.otName });
              const bad = findings.filter((f) => f.severity === "bad").length;
              const warn = findings.filter((f) => f.severity === "warn").length;
              return (
                <div key={i} className={`slot ${i === selected ? "slot--active" : ""}`} {...drag.rowProps(i)}>
                  <ReorderControls
                    index={i}
                    count={party.length}
                    label={slot.nickname || sp?.name || "slot"}
                    gripProps={drag.gripProps(i)}
                    onMove={(d) => drag.moveBy(i, d)}
                  />
                  <button type="button" className="slot__btn" onClick={() => setSelected(i)}>
                    <Sprite dexNo={sp?.dexNo ?? 0} size={40} alt={sp?.name ?? ""} />
                    <span className="slot__text">
                      <span className="slot__name">{slot.nickname || sp?.name}</span>
                      <span className="slot__meta mono">Lv{slot.mon.level} · {sp?.name}</span>
                    </span>
                    {(bad > 0 || warn > 0) && (
                      <span
                        className={`slot__legality ${bad ? "slot__legality--bad" : ""}`}
                        title={`${bad + warn} legality finding(s) — see the Legality tab`}
                        data-testid="slot-legality"
                      >
                        {bad + warn}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </aside>

          {active && (
            <div className="detail-main">
              <div className="detail-main__toolbar">
                <span className="detail-main__title">Slot {selected + 1}</span>
                <Button size="sm" variant="ghost" onClick={exportActivePk1} data-testid="pk1-export">
                  Export .pk1
                </Button>
                <Button variant="danger" size="sm" onClick={() => remove(selected)}>
                  Remove
                </Button>
              </div>
              <MonEditor
                mon={active.mon}
                names={{ nickname: active.nickname, otName: active.otName }}
                tab={tab}
                onTab={setTab}
                onChange={(mon, names) => commit(selected, mon, names)}
              />
            </div>
          )}
        </div>
      )}

      <TeamCoverage party={party} />

      <DayCarePanel />
    </div>
  );
}

/** The one boarded day-care Pokémon (box-struct record + names). */
function DayCarePanel() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const [tab, setTab] = useState<MonEditorTab>("summary");

  const dayCare = getDayCare(bytes);
  const playerName = getPlayerName(bytes);

  function board() {
    const mon = createMon(BULBASAUR, 5);
    mutate((b) =>
      setDayCareMon(b, mon, {
        nickname: speciesByInternalId(BULBASAUR)?.name ?? "",
        otName: playerName || "RED",
      }),
    );
  }

  return (
    <Panel
      className="daycare-panel"
      title={
        <span className="panel-title-row">
          Day care <OffsetChip offset={OFFSETS.dayCareInUse} onJump={useNav.getState().jumpToHex} />
        </span>
      }
      actions={
        dayCare.inUse ? (
          <Button variant="danger" size="sm" onClick={() => mutate((b) => clearDayCare(b))}>
            Empty day care
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={board}>
            Board a Pokémon
          </Button>
        )
      }
    >
      {dayCare.inUse && dayCare.mon ? (
        <MonEditor
          mon={dayCare.mon.mon}
          names={{ nickname: dayCare.mon.nickname, otName: dayCare.mon.otName }}
          tab={tab}
          onTab={setTab}
          onChange={(mon, names) => {
            const nickname = names.nickname.trim() || speciesByInternalId(mon.species)?.name || "";
            mutate((b) => setDayCareMon(b, mon, { ...names, nickname }));
          }}
        />
      ) : (
        <p className="hint-line">
          Nothing is boarded. The day-care attendant on Route 5 holds one Pokémon; it levels up as you
          walk.
        </p>
      )}
    </Panel>
  );
}
