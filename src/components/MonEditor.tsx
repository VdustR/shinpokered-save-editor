import { useState } from "react";
import { recalcDerivedFields } from "../save/derive";
import { baseStatsOf, moveInfo, moveName, speciesByInternalId, typeName } from "../save/gamedata";
import { moveLegality } from "../save/legality";
import { makePpByte, maxPp, ppCurrent, ppUps, type Dvs, type MonRecord } from "../save/pokemon";
import { moveInArray } from "../save/reorder";
import { legalityReport } from "../save/report";
import { genderOf, isShinyDvs, makeShinyDvs } from "../save/shin";
import type { MonNames } from "../save/savefile";
import { Button, Field, NumberInput, PickerTrigger, Segmented, Select, TextInput } from "./ui/ui";
import { MovePicker } from "./MovePicker";
import { ReorderControls } from "./ReorderControls";
import { SpeciesPicker } from "./SpeciesPicker";
import { Sprite } from "./Sprite";
import { StatBars } from "./StatBars";
import { useDragReorder } from "./useDragReorder";

export type MonEditorTab = "summary" | "moves" | "dvs" | "legality";
type Tab = MonEditorTab;

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
  const gender = genderOf(mon.species, mon.dvs.atk);
  const shiny = isShinyDvs(mon.dvs);

  /** Reorder the four move slots, moving each move's PP with it. */
  const moveDrag = useDragReorder((from, to) => {
    patch((d) => {
      d.moves = moveInArray(d.moves, from, to) as MonRecord["moves"];
      d.pp = moveInArray(d.pp, from, to) as MonRecord["pp"];
    }, false);
  }, 4);

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
          {gender && (
            <span
              className={`gender-tag gender-tag--${gender}`}
              title="Shin derives gender from the Attack DV (Gen 2 rule). In-game symbols only appear once the Oak-aide 'Caught & gender indicators' toggle is on (see Trainer → Shin features) and the Pokédex is obtained."
            >
              {gender === "male" ? "♂" : "♀"}
            </span>
          )}
          {shiny && (
            <span className="shiny-tag" title="Shiny DVs (Gen 2 pattern): Def/Spd/Spc 10, Atk bit 1">
              ✦ Shiny
            </span>
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
          { value: "legality", label: "Legality" },
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
              <div className="move-row" key={i} {...moveDrag.rowProps(i)}>
                <ReorderControls
                  index={i}
                  count={4}
                  label={`move ${i + 1}`}
                  gripProps={moveDrag.gripProps(i)}
                  onMove={(d) => moveDrag.moveBy(i, d)}
                />
                <div className="move-row__pick">
                  <PickerTrigger
                    label={mon.moves[i] ? moveName(mon.moves[i]) : "Empty slot"}
                    empty={!mon.moves[i]}
                    ariaLabel={`Move ${i + 1}`}
                    onOpen={() => setOpenMoveSlot(i)}
                  />
                  {/* Kept outside .move-row__meta so the warning stays visible on mobile. */}
                  {mon.moves[i] && !moveLegality(mon.species, mon.moves[i]) ? (
                    <span className="move-row__illegal" title="Not normally learnable by this Pokémon">
                      Illegal
                    </span>
                  ) : null}
                </div>
                <div className="move-row__meta">
                  {info ? (
                    <>
                      <span className={`type-tag type-${info.type}`}>{typeName(info.type)}</span>
                      <span className="move-row__stat mono" title="Power">
                        {info.power || "—"}<small>pow</small>
                      </span>
                      <span className="move-row__stat mono" title="Accuracy">
                        {info.accuracy || "—"}<small>%</small>
                      </span>
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
            speciesId={mon.species}
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
              <Button
                size="sm"
                disabled={shiny}
                title="Set Def/Spd/Spc DVs to 10 and Attack DV bit 1 (Gen 2 shiny pattern)"
                onClick={() => patch((d) => (d.dvs = makeShinyDvs(d.dvs)))}
              >
                {shiny ? "✦ Shiny" : "Make shiny"}
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
                  aria-label={`${k.toUpperCase()} DV`}
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
                  aria-label={`${k.toUpperCase()} Stat EXP`}
                  min={0}
                  max={65535}
                  onValue={(n) => patch((d) => (d.statExp[k] = n))}
                />
              </Field>
            ))}
          </div>
        </div>
      )}

      {tab === "legality" && <LegalitySection mon={mon} names={names} />}
    </div>
  );
}

function LegalitySection({ mon, names }: { mon: MonRecord; names: MonNames }) {
  const findings = legalityReport(mon, names);
  return (
    <div className="mon-editor__section">
      {findings.length === 0 ? (
        <p className="legality-ok" data-testid="legality-ok">
          No issues found — this mon is consistent with normal play.
        </p>
      ) : (
        <ul className="legality-list" data-testid="legality-list">
          {findings.map((f) => (
            <li key={`${f.area}:${f.message}`} className={`legality-item legality-item--${f.severity}`}>
              <span className="legality-item__tag">{f.area}</span>
              <span className="legality-item__msg">{f.message}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="hint-line">
        Red entries are impossible in normal play (glitch/hacked territory); amber ones the game may
        rewrite on its own (e.g. when depositing into a box); grey notes are informational.
      </p>
    </div>
  );
}
