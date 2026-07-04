import { useState } from "react";
import { recalcDerivedFields } from "../save/derive";
import { baseStatsOf, moveInfo, moveName, speciesByInternalId, typeName } from "../save/gamedata";
import { makePpByte, maxPp, ppCurrent, ppUps, type Dvs, type MonRecord } from "../save/pokemon";
import type { MonNames } from "../save/savefile";
import { Button, Field, NumberInput, PickerTrigger, Segmented, Select, TextInput } from "./ui/ui";
import { MovePicker } from "./MovePicker";
import { SpeciesPicker } from "./SpeciesPicker";
import { Sprite } from "./Sprite";
import { StatBars } from "./StatBars";

type Tab = "summary" | "moves" | "dvs";

export function MonEditor({
  mon,
  names,
  tab,
  onTab,
  onChange,
}: {
  mon: MonRecord;
  names: MonNames;
  tab: Tab;
  onTab: (t: Tab) => void;
  onChange: (mon: MonRecord, names: MonNames) => void;
}) {
  const species = speciesByInternalId(mon.species);
  const base = baseStatsOf(mon.species);
  const dexNo = species?.dexNo ?? 0;
  const [openMoveSlot, setOpenMoveSlot] = useState<number | null>(null);
  const [speciesOpen, setSpeciesOpen] = useState(false);

  /** Change species, keeping types/catch rate and (for non-custom names) the nickname in sync. */
  function changeSpecies(id: number) {
    const nextNames = isCustomNickname ? names : { ...names, nickname: "" };
    patch(
      (d) => {
        d.species = id;
        const nb = baseStatsOf(id);
        if (nb) {
          d.types = [nb.types[0], nb.types[1]];
          d.catchRate = nb.catchRate;
        }
      },
      true,
      nextNames,
    );
  }
  // A non-nicknamed Gen 1 mon stores its species name; treat that (and an
  // empty field) as "not custom" so the input shows a placeholder rather than
  // a pre-filled value. The commit path writes the species name when blank.
  // Compare case-insensitively so any casing of the stored name still matches.
  const isCustomNickname =
    names.nickname !== "" && names.nickname.toUpperCase() !== (species?.name ?? "").toUpperCase();

  /** Apply a mutation to a clone, recalc derived fields, and persist. */
  function patch(fn: (draft: MonRecord) => void, recalc = true, namesOverride?: MonNames) {
    const draft: MonRecord = structuredClone(mon);
    fn(draft);
    if (recalc) recalcDerivedFields(draft);
    onChange(draft, namesOverride ?? names);
  }

  /** Perfect DVs + full stat EXP, refill PP, and fully heal. */
  function maximize() {
    patch((d) => {
      d.dvs = { atk: 15, def: 15, spd: 15, spc: 15 };
      d.statExp = { hp: 65535, atk: 65535, def: 65535, spd: 65535, spc: 65535 };
      // Full PP with 3 PP Ups on every move; unknown move ids stay empty (PP 0).
      d.pp = d.moves.map((id) => {
        const info = id ? moveInfo(id) : undefined;
        if (!info) return 0;
        return makePpByte(maxPp(info.pp, 3), 3);
      }) as MonRecord["pp"];
      d.status = 0;
      d.currentHp = 0xffff; // recalc clamps to the new max HP (full heal)
    });
  }

  return (
    <div className="mon-editor">
      <div className="mon-editor__identity">
        <Sprite dexNo={dexNo} size={72} alt={species?.name ?? "Unknown"} />
        <div className="mon-editor__id-fields">
          <Field label="Species">
            <PickerTrigger
              label={species ? `#${String(species.dexNo).padStart(3, "0")} ${species.name}` : "Unknown"}
              ariaLabel="Species"
              onOpen={() => setSpeciesOpen(true)}
            />
          </Field>
          <Field label="Nickname" hint="Blank keeps the species name.">
            <TextInput
              value={isCustomNickname ? names.nickname : ""}
              placeholder={species?.name ?? ""}
              maxLength={10}
              onChange={(e) => onChange(mon, { ...names, nickname: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Level" hint="1 – 100">
            <NumberInput value={mon.level} min={1} max={100} onValue={(n) => patch((d) => (d.level = n))} />
          </Field>
        </div>
      </div>

      <SpeciesPicker
        open={speciesOpen}
        selectedId={mon.species}
        onClose={() => setSpeciesOpen(false)}
        onSelect={changeSpecies}
      />

      {base && (
        <div className="mon-editor__types">
          <span className={`type-tag type-${base.types[0]}`}>{typeName(base.types[0])}</span>
          {base.types[1] !== base.types[0] && (
            <span className={`type-tag type-${base.types[1]}`}>{typeName(base.types[1])}</span>
          )}
          <span className="mon-editor__ot mono">OT {mon.otId.toString().padStart(5, "0")} · {names.otName}</span>
        </div>
      )}

      <Segmented
        ariaLabel="Editor section"
        value={tab}
        onChange={(t) => onTab(t as Tab)}
        options={[
          { value: "summary", label: "Summary" },
          { value: "moves", label: "Moves" },
          { value: "dvs", label: "DVs & EXP" },
        ]}
      />

      {tab === "summary" && (
        <div className="mon-editor__section">
          <StatBars mon={mon} />
          <div className="form-grid form-grid--2">
            <Field label="Current HP">
              <NumberInput
                value={mon.currentHp}
                min={0}
                max={mon.maxHp ?? 999}
                onValue={(n) => patch((d) => (d.currentHp = n), false)}
              />
            </Field>
            <Field label="EXP" hint="Auto-set from level; edit to fine-tune.">
              <NumberInput value={mon.exp} min={0} max={0xffffff} onValue={(n) => patch((d) => (d.exp = n), false)} />
            </Field>
          </div>
        </div>
      )}

      {tab === "moves" && (
        <div className="mon-editor__section">
          <p className="hint-line">
            PP is stored as current PP plus a PP Up count (0–3). Max PP grows with PP Ups.
          </p>
          {[0, 1, 2, 3].map((i) => {
            const info = moveInfo(mon.moves[i]);
            const byte = mon.pp[i];
            const ups = ppUps(byte);
            const current = ppCurrent(byte);
            const max = info ? maxPp(info.pp, ups) : 0;
            return (
              <div className="move-row" key={i}>
                <PickerTrigger
                  label={mon.moves[i] ? moveName(mon.moves[i]) : "Empty slot"}
                  empty={!mon.moves[i]}
                  ariaLabel={`Move ${i + 1}`}
                  onOpen={() => setOpenMoveSlot(i)}
                />
                <div className="move-row__meta mono">
                  {info ? (
                    <>
                      <span title="Type">{typeName(info.type)}</span>
                      <span title="Power">{info.power || "—"} pow</span>
                      <span title="Accuracy">{info.accuracy || "—"}%</span>
                    </>
                  ) : (
                    <span className="move-row__empty">empty slot</span>
                  )}
                </div>
                {info ? (
                  <div className="move-row__pp">
                    <label className="move-pp">
                      <span className="move-pp__cap">PP</span>
                      <NumberInput
                        className="move-pp__cur"
                        value={current}
                        min={0}
                        max={max}
                        onValue={(n) => patch((d) => (d.pp[i] = makePpByte(n, ups)), false)}
                        aria-label={`Move ${i + 1} current PP`}
                      />
                      <span className="move-pp__max mono">/ {max}</span>
                    </label>
                    <label className="move-pp move-pp--ups">
                      <span className="move-pp__cap">PP Ups</span>
                      <Select
                        value={ups}
                        aria-label={`Move ${i + 1} PP Ups`}
                        onChange={(e) => {
                          const nextUps = Number(e.target.value);
                          patch((d) => {
                            // Refill to the new max so the count stays consistent.
                            d.pp[i] = makePpByte(maxPp(info.pp, nextUps), nextUps);
                          }, false);
                        }}
                      >
                        {[0, 1, 2, 3].map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </div>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
          <MovePicker
            open={openMoveSlot !== null}
            selectedId={openMoveSlot !== null ? mon.moves[openMoveSlot] : 0}
            monTypes={base ? [base.types[0], base.types[1]] : undefined}
            onClose={() => setOpenMoveSlot(null)}
            onSelect={(id) => {
              const slot = openMoveSlot;
              if (slot === null) return;
              patch((d) => {
                d.moves[slot] = id;
                const chosen = id ? moveInfo(id) : undefined;
                d.pp[slot] = chosen ? makePpByte(chosen.pp, 0) : 0;
              }, false);
            }}
          />
        </div>
      )}

      {tab === "dvs" && (
        <div className="mon-editor__section">
          <div className="mon-editor__toolbar">
            <p className="hint-line">DVs (0–15) and Stat EXP (0–65535). Changing these recalculates stats.</p>
            <div className="btn-row">
              <Button
                size="sm"
                onClick={() => patch((d) => (d.dvs = { atk: 15, def: 15, spd: 15, spc: 15 }))}
              >
                Max DVs
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  patch((d) => (d.statExp = { hp: 65535, atk: 65535, def: 65535, spd: 65535, spc: 65535 }))
                }
              >
                Max Stat EXP
              </Button>
              <Button size="sm" variant="ghost" onClick={maximize}>
                Maximize all
              </Button>
            </div>
          </div>
          <div className="form-grid form-grid--2">
            {(["atk", "def", "spd", "spc"] as (keyof Dvs)[]).map((k) => (
              <Field key={k} label={`${k.toUpperCase()} DV`}>
                <NumberInput
                  value={mon.dvs[k]}
                  min={0}
                  max={15}
                  onValue={(n) => patch((d) => (d.dvs[k] = n))}
                />
              </Field>
            ))}
          </div>
          <div className="form-grid form-grid--2">
            {(["hp", "atk", "def", "spd", "spc"] as (keyof MonRecord["statExp"])[]).map((k) => (
              <Field key={k} label={`${k.toUpperCase()} Stat EXP`}>
                <NumberInput
                  value={mon.statExp[k]}
                  min={0}
                  max={65535}
                  onValue={(n) => patch((d) => (d.statExp[k] = n))}
                />
              </Field>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
