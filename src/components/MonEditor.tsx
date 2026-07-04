import { recalcDerivedFields } from "../save/derive";
import {
  DEX_SPECIES,
  MOVES,
  baseStatsOf,
  moveInfo,
  speciesByInternalId,
  typeName,
} from "../save/gamedata";
import type { Dvs, MonRecord } from "../save/pokemon";
import type { MonNames } from "../save/savefile";
import { Button, Field, NumberInput, Segmented, Select, TextInput } from "./ui/ui";
import { Sprite } from "./Sprite";
import { StatBars } from "./StatBars";

type Tab = "summary" | "moves" | "dvs";

const MOVE_OPTIONS = [{ id: 0, name: "—" }, ...MOVES];

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
  // A non-nicknamed Gen 1 mon stores its species name; treat that (and an
  // empty field) as "not custom" so the input shows a placeholder rather than
  // a pre-filled value. The commit path writes the species name when blank.
  const isCustomNickname = names.nickname !== "" && names.nickname !== species?.name;

  /** Apply a mutation to a clone, recalc derived fields, and persist. */
  function patch(fn: (draft: MonRecord) => void, recalc = true) {
    const draft: MonRecord = structuredClone(mon);
    fn(draft);
    if (recalc) recalcDerivedFields(draft);
    onChange(draft, names);
  }

  /** Perfect DVs + full stat EXP, refill PP, and fully heal. */
  function maximize() {
    patch((d) => {
      d.dvs = { atk: 15, def: 15, spd: 15, spc: 15 };
      d.statExp = { hp: 65535, atk: 65535, def: 65535, spd: 65535, spc: 65535 };
      d.pp = d.moves.map((id) => (id ? (moveInfo(id)?.pp ?? 0) : 0)) as MonRecord["pp"];
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
            <Select
              value={mon.species}
              onChange={(e) => {
                const id = Number(e.target.value);
                patch((d) => {
                  d.species = id;
                  const nb = baseStatsOf(id);
                  if (nb) {
                    d.types = [nb.types[0], nb.types[1]];
                    d.catchRate = nb.catchRate;
                  }
                });
              }}
            >
              {DEX_SPECIES.map((s) => (
                <option key={s.internalId} value={s.internalId}>
                  #{String(s.dexNo).padStart(3, "0")} {s.name}
                </option>
              ))}
            </Select>
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
          {[0, 1, 2, 3].map((i) => {
            const info = moveInfo(mon.moves[i]);
            return (
              <div className="move-row" key={i}>
                <Select
                  value={mon.moves[i]}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    patch((d) => {
                      d.moves[i] = id;
                      d.pp[i] = id ? (moveInfo(id)?.pp ?? 0) : 0;
                    }, false);
                  }}
                >
                  {MOVE_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
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
                <NumberInput
                  className="move-row__pp"
                  value={mon.pp[i]}
                  min={0}
                  max={63}
                  onValue={(n) => patch((d) => (d.pp[i] = n), false)}
                  aria-label={`Move ${i + 1} PP`}
                />
              </div>
            );
          })}
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
