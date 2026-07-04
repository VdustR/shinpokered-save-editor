import { useState } from "react";
import { createMon } from "../save/derive";
import { DEX_SPECIES, speciesByInternalId } from "../save/gamedata";
import type { MonRecord } from "../save/pokemon";
import {
  getParty,
  removePartyMon,
  setPartyMon,
  type MonNames,
} from "../save/savefile";
import { PARTY_LENGTH } from "../save/layout";
import { useSaveStore } from "../state/store";
import { Button } from "../components/ui/ui";
import { EmptyLine } from "../components/EmptyLine";
import { MonEditor } from "../components/MonEditor";
import { PageHeader } from "../components/PageHeader";
import { Sprite } from "../components/Sprite";

const BULBASAUR = DEX_SPECIES[0]?.internalId ?? 0x99;

export function PartyPage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<"summary" | "moves" | "dvs">("summary");

  const party = getParty(bytes);
  const active = party[selected];

  function commit(index: number, mon: MonRecord, names: MonNames) {
    mutate((b) => setPartyMon(b, index, mon, names));
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

  return (
    <div className="page">
      <PageHeader
        title="Party"
        subtitle="Up to six Pokémon. Editing level, DVs, or stat EXP recalculates stats automatically."
        actions={
          <Button variant="primary" size="sm" onClick={addMon} disabled={party.length >= PARTY_LENGTH}>
            Add Pokémon
          </Button>
        }
      />

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
              return (
                <button
                  key={i}
                  type="button"
                  className={`slot ${i === selected ? "slot--active" : ""}`}
                  onClick={() => setSelected(i)}
                >
                  <Sprite dexNo={sp?.dexNo ?? 0} size={40} alt={sp?.name ?? ""} />
                  <span className="slot__text">
                    <span className="slot__name">{slot.nickname || sp?.name}</span>
                    <span className="slot__meta mono">Lv{slot.mon.level} · {sp?.name}</span>
                  </span>
                </button>
              );
            })}
          </aside>

          {active && (
            <div className="detail-main">
              <div className="detail-main__toolbar">
                <span className="detail-main__title">Slot {selected + 1}</span>
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
    </div>
  );
}
