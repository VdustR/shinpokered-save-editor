import { baseStatsOf } from "../save/gamedata";
import type { MonRecord } from "../save/pokemon";

const ROWS: { key: "hp" | "atk" | "def" | "spd" | "spc"; label: string }[] = [
  { key: "hp", label: "HP" },
  { key: "atk", label: "Attack" },
  { key: "def", label: "Defense" },
  { key: "spd", label: "Speed" },
  { key: "spc", label: "Special" },
];

/** Battle stats with bars scaled against a reference max (~255 for HP at L50). */
export function StatBars({ mon }: { mon: MonRecord }) {
  const base = baseStatsOf(mon.species);
  const values: Record<string, number> = {
    hp: mon.maxHp ?? 0,
    atk: mon.stats?.atk ?? 0,
    def: mon.stats?.def ?? 0,
    spd: mon.stats?.spd ?? 0,
    spc: mon.stats?.spc ?? 0,
  };
  const baseValues: Record<string, number | undefined> = base
    ? { hp: base.hp, atk: base.atk, def: base.def, spd: base.spd, spc: base.spc }
    : {};
  const max = 300;
  return (
    <div className="statbars">
      {ROWS.map((row) => {
        const value = values[row.key];
        const pct = Math.min(100, (value / max) * 100);
        return (
          <div className="statbar" key={row.key}>
            <span className="statbar__label">{row.label}</span>
            <span className="statbar__value mono">{value}</span>
            <span className="statbar__track">
              <span className="statbar__fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="statbar__base mono" title="Base stat">
              {baseValues[row.key] ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
