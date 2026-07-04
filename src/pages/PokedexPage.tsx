import { useMemo } from "react";
import { DEX_SPECIES } from "../save/gamedata";
import { getParty, isDexOwned, isDexSeen, readBox, setDexOwned, setDexSeen } from "../save/savefile";
import { NUM_BOXES } from "../save/layout";
import { useSaveStore } from "../state/store";
import { Button, Panel, Segmented } from "../components/ui/ui";
import { PageHeader } from "../components/PageHeader";
import { Sprite } from "../components/Sprite";
import { useState } from "react";

type Mode = "seen" | "owned";

export function PokedexPage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const [mode, setMode] = useState<Mode>("owned");

  const counts = useMemo(() => {
    let seen = 0;
    let owned = 0;
    for (const s of DEX_SPECIES) {
      if (isDexSeen(bytes, s.dexNo)) seen += 1;
      if (isDexOwned(bytes, s.dexNo)) owned += 1;
    }
    return { seen, owned };
  }, [bytes]);

  function setAll(kind: Mode, value: boolean) {
    mutate((b) => {
      for (const s of DEX_SPECIES) {
        if (kind === "owned") {
          setDexOwned(b, s.dexNo, value);
          if (value) setDexSeen(b, s.dexNo, true);
        } else {
          setDexSeen(b, s.dexNo, value);
          if (!value) setDexOwned(b, s.dexNo, false);
        }
      }
    });
  }

  function syncFromCollection() {
    mutate((b) => {
      const mark = (species: number) => {
        const dex = DEX_SPECIES.find((s) => s.internalId === species)?.dexNo;
        if (dex) {
          setDexSeen(b, dex, true);
          setDexOwned(b, dex, true);
        }
      };
      for (const slot of getParty(b)) mark(slot.mon.species);
      for (let box = 0; box < NUM_BOXES; box++) for (const slot of readBox(b, box).mons) mark(slot.mon.species);
    });
  }

  return (
    <div className="page">
      <PageHeader
        title="Pokédex"
        subtitle={`${counts.owned} owned · ${counts.seen} seen of 151`}
        actions={
          <Segmented
            ariaLabel="Toggle mode"
            value={mode}
            onChange={(m) => setMode(m as Mode)}
            options={[
              { value: "owned", label: "Owned" },
              { value: "seen", label: "Seen" },
            ]}
          />
        }
      />

      <Panel
        title="Bulk actions"
        actions={
          <div className="btn-row">
            <Button size="sm" onClick={() => setAll(mode, true)}>
              Mark all {mode}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAll(mode, false)}>
              Clear all {mode}
            </Button>
            <Button size="sm" variant="default" onClick={syncFromCollection}>
              Sync from party + boxes
            </Button>
          </div>
        }
      >
        <p className="hint-line">
          Editing <strong>{mode}</strong>. Marking a species owned also marks it seen; clearing seen also clears
          owned, matching the game's own rules.
        </p>
      </Panel>

      <div className="dex-grid">
        {DEX_SPECIES.map((s) => {
          const seen = isDexSeen(bytes, s.dexNo);
          const owned = isDexOwned(bytes, s.dexNo);
          const on = mode === "owned" ? owned : seen;
          return (
            <button
              key={s.dexNo}
              type="button"
              className={`dex-cell ${on ? "dex-cell--on" : ""} ${owned ? "dex-cell--owned" : seen ? "dex-cell--seen" : ""}`}
              aria-pressed={on}
              title={`#${s.dexNo} ${s.name} — ${owned ? "owned" : seen ? "seen" : "unseen"}`}
              onClick={() =>
                mutate((b) => {
                  if (mode === "owned") {
                    const v = !owned;
                    setDexOwned(b, s.dexNo, v);
                    if (v) setDexSeen(b, s.dexNo, true);
                  } else {
                    const v = !seen;
                    setDexSeen(b, s.dexNo, v);
                    if (!v) setDexOwned(b, s.dexNo, false);
                  }
                })
              }
            >
              <span className="dex-cell__no mono">{String(s.dexNo).padStart(3, "0")}</span>
              <Sprite dexNo={s.dexNo} size={40} alt={s.name} />
              <span className="dex-cell__name">{s.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
