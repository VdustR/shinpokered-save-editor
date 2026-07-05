import { speciesByInternalId, typeName } from "../save/gamedata";
import type { MonSlot } from "../save/savefile";
import { CHART_TYPES, defenseProfile, offenseCoverage } from "../save/typechart";
import { Panel } from "./ui/ui";

function multLabel(m: number): string {
  if (Number.isNaN(m)) return "—";
  if (m === 0) return "×0";
  if (m === 0.25) return "×¼";
  if (m === 0.5) return "×½";
  return `×${m}`;
}

function multClass(m: number): string {
  if (Number.isNaN(m)) return "cov--none";
  if (m === 0) return "cov--immune";
  if (m < 1) return "cov--bad";
  if (m > 1) return "cov--good";
  return "cov--neutral";
}

/** Offensive coverage and defensive weaknesses for the current party. */
export function TeamCoverage({ party }: { party: MonSlot[] }) {
  if (party.length === 0) return null;
  const coverage = offenseCoverage(party.map((s) => s.mon));
  return (
    <Panel title="Team coverage" className="span-2">
      <p className="hint-line">
        Offense: the best multiplier any damaging move on the team reaches against each defending type
        (mono-type table, Shin chart with the Ghost-vs-Psychic fix).
      </p>
      <div className="coverage-grid" data-testid="offense-coverage">
        {CHART_TYPES.map((t) => {
          const m = coverage.get(t) ?? 1;
          return (
            <span key={t} className={`coverage-cell ${multClass(m)}`}>
              <span className={`type-tag type-${t}`}>{typeName(t)}</span>
              <span className="coverage-cell__mult mono">{multLabel(m)}</span>
            </span>
          );
        })}
      </div>

      <p className="hint-line">Defense: weaknesses (red), immunities (grey) per member.</p>
      <ul className="defense-list" data-testid="defense-list">
        {party.map((slot, i) => {
          const profile = defenseProfile(slot.mon.types);
          const name = slot.nickname || speciesByInternalId(slot.mon.species)?.name || `Slot ${i + 1}`;
          return (
            <li key={i} className="defense-row">
              <span className="defense-row__name">{name}</span>
              <span className="defense-row__tags">
                {profile.weak.map((t) => (
                  <span key={`w${t}`} className="coverage-cell cov--weak">
                    <span className={`type-tag type-${t}`}>{typeName(t)}</span>
                  </span>
                ))}
                {profile.immune.map((t) => (
                  <span key={`i${t}`} className="coverage-cell cov--immune">
                    <span className={`type-tag type-${t}`}>{typeName(t)}</span>
                    <span className="coverage-cell__mult mono">×0</span>
                  </span>
                ))}
                {profile.weak.length === 0 && profile.immune.length === 0 && (
                  <span className="hint-line">No weaknesses or immunities.</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
